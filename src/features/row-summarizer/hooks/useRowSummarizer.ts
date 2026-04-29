'use client'

import { useCallback, useMemo, useState } from 'react'
import { cloneFortuneData, cloneSheetWithData, getSheetMatrix } from '@/lib/fortuneSheet'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { buildRowSummaryData, type ColumnStats, type RowSummarySelection } from '../utils/rowStats'
import type { Cell, Sheet } from '@fortune-sheet/core'

interface SummarizeResponse {
  summary?: string
  insights?: string[]
  dataCharacterization?: string
  error?: string
}

interface RowSummarizerState {
  dataCharacterization: string
  error: string | null
  insights: string[]
  isLoading: boolean
  isOpen: boolean
  rowCount: number
  stats: ColumnStats[]
  summary: string
}

const initialState: RowSummarizerState = {
  dataCharacterization: '',
  error: null,
  insights: [],
  isLoading: false,
  isOpen: false,
  rowCount: 0,
  stats: [],
  summary: '',
}

function buildPlainTextReport(state: RowSummarizerState): string {
  const statLines = state.stats
    .filter((stat) => stat.filledCount > 0 || stat.emptyCount > 0)
    .map((stat) => {
      if (stat.type === 'number') {
        return `- ${stat.header}: sum ${stat.sum ?? 0}, average ${stat.average ?? 0}, min ${stat.min ?? 0}, max ${stat.max ?? 0}`
      }

      if (stat.type === 'date') {
        return `- ${stat.header}: ${stat.dateMin ?? 'n/a'} to ${stat.dateMax ?? 'n/a'}`
      }

      return `- ${stat.header}: ${stat.uniqueCount ?? 0} unique values, most common ${stat.mostCommonValue ?? 'n/a'}`
    })

  return [
    `AI Row Summary`,
    `Rows: ${state.rowCount}`,
    '',
    state.summary,
    '',
    'Key stats:',
    ...statLines,
    '',
    'AI insights:',
    ...state.insights.map((insight) => `- ${insight}`),
  ].join('\n')
}

function summaryCell(value: string, row: number, columnCount: number): Cell {
  return {
    v: value,
    m: value,
    it: 1,
    bg: '#F8FAFC',
    ht: 0,
    vt: 0,
    tb: '2',
    mc: { r: row, c: 0, rs: 1, cs: columnCount },
  }
}

function coveredMergeCell(row: number): Cell {
  return { mc: { r: row, c: 0 } }
}

function withInsertedSummaryRow(
  sheets: Sheet[],
  selection: RowSummarySelection,
  summary: string,
  activeSheetId: string
): Sheet[] {
  const nextSheets = cloneFortuneData(sheets)
  const sheet = nextSheets[selection.sheetIndex]
  if (!sheet) return sheets

  const data = getSheetMatrix(sheet).map((row) => [...(row ?? [])])
  const insertRow = Math.max(selection.endRow + 1, 0)
  const columnCount = Math.max(sheet.column ?? 0, data[0]?.length ?? 0, 1)
  while (data.length < insertRow) {
    data.push([])
  }

  const rowValue = `AI Summary: ${summary}`
  const insertedRow = Array.from({ length: columnCount }, (_, columnIndex) =>
    columnIndex === 0 ? summaryCell(rowValue, insertRow, columnCount) : coveredMergeCell(insertRow)
  )
  data.splice(insertRow, 0, insertedRow)

  const existingMerge = sheet.config?.merge ?? {}
  const mergeKey = `${insertRow}_0`
  const nextSheet = cloneSheetWithData(sheet, data)
  nextSheets[selection.sheetIndex] = {
    ...nextSheet,
    ...(typeof sheet.id === 'string' ? { id: sheet.id } : {}),
    ...(sheet.id === activeSheetId
      ? { status: 1 }
      : sheet.status !== undefined
        ? { status: sheet.status }
        : {}),
    config: {
      ...(nextSheet.config ?? {}),
      merge: {
        ...existingMerge,
        [mergeKey]: { r: insertRow, c: 0, rs: 1, cs: columnCount },
      },
      borderInfo: [
        ...((nextSheet.config?.borderInfo as unknown[] | undefined) ?? []),
        {
          rangeType: 'range',
          borderType: 'border-top',
          style: '8',
          color: '#E2E8F0',
          range: [{ row: [insertRow, insertRow], column: [0, columnCount - 1] }],
        },
      ],
    },
  }

  return nextSheets
}

export function useRowSummarizer() {
  const {
    gridInstance,
    gridSheets,
    replaceGridSheets,
    setFormulaBarValue,
    setSelectedCell,
    setSelectedRange,
  } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const [state, setState] = useState<RowSummarizerState>(initialState)
  const [selection, setSelection] = useState<RowSummarySelection | null>(null)

  const activeSheet = useMemo(
    () => gridSheets.find((sheet) => sheet.id === activeSheetId) ?? gridSheets[0] ?? null,
    [activeSheetId, gridSheets]
  )

  const close = useCallback(() => {
    setState((current) => ({ ...current, isOpen: false, isLoading: false }))
  }, [])

  const open = useCallback(
    async (nextSelection: RowSummarySelection) => {
      const targetSheet = gridSheets[nextSelection.sheetIndex] ?? activeSheet
      if (!targetSheet) return

      const summaryData = buildRowSummaryData(
        targetSheet,
        nextSelection.startRow,
        nextSelection.endRow
      )
      if (summaryData.rowCount < 2) {
        setState({
          ...initialState,
          error: 'Select at least two complete rows to summarize.',
          isOpen: true,
          rowCount: summaryData.rowCount,
        })
        return
      }

      setSelection(nextSelection)
      setState({
        ...initialState,
        isLoading: true,
        isOpen: true,
        rowCount: summaryData.rowCount,
        stats: summaryData.stats,
      })

      try {
        const response = await fetch('/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headers: summaryData.headers,
            rows: summaryData.sampledRows,
            rowCount: summaryData.rowCount,
            stats: summaryData.stats,
          }),
        })
        const data = (await response.json()) as SummarizeResponse

        if (!response.ok || !data.summary) {
          throw new Error(data.error || 'Unable to summarize the selected rows.')
        }

        setState({
          dataCharacterization: data.dataCharacterization ?? '',
          error: null,
          insights: (data.insights ?? []).slice(0, 3),
          isLoading: false,
          isOpen: true,
          rowCount: summaryData.rowCount,
          stats: summaryData.stats,
          summary: data.summary,
        })
      } catch (error) {
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : 'Unable to summarize the selected rows.',
          isLoading: false,
        }))
      }
    },
    [activeSheet, gridSheets]
  )

  const copySummary = useCallback(() => {
    const report = buildPlainTextReport(state)
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(report)
    }
  }, [state])

  const exportReport = useCallback(() => {
    const report = buildPlainTextReport(state)
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `row-summary-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [state])

  const insertBelowSelection = useCallback(() => {
    if (!selection || !state.summary) return

    const nextSheets = withInsertedSummaryRow(gridSheets, selection, state.summary, activeSheetId)
    replaceGridSheets(nextSheets)

    const insertRow = selection.endRow + 1
    const sheet = nextSheets[selection.sheetIndex]
    const columnCount = Math.max(sheet?.column ?? 1, 1)
    const nextSelectedCell = { row: insertRow, col: 0, sheet: selection.sheetIndex }
    setSelectedCell(nextSelectedCell)
    setSelectedRange({
      start: nextSelectedCell,
      end: { row: insertRow, col: columnCount - 1, sheet: selection.sheetIndex },
    })
    setFormulaBarValue(`AI Summary: ${state.summary}`)

    window.setTimeout(() => {
      try {
        gridInstance?.activateSheet({ id: activeSheetId })
        gridInstance?.setSelection(
          [{ row: [insertRow, insertRow], column: [0, columnCount - 1] }],
          { id: activeSheetId }
        )
        gridInstance?.mergeCells(
          [{ row: [insertRow, insertRow], column: [0, columnCount - 1] }],
          'merge-all',
          { id: activeSheetId }
        )
      } catch {
        // The stored merge metadata keeps the inserted summary row intact across reloads.
      }
    }, 0)

    close()
  }, [
    activeSheetId,
    close,
    gridInstance,
    gridSheets,
    replaceGridSheets,
    selection,
    setFormulaBarValue,
    setSelectedCell,
    setSelectedRange,
    state.summary,
  ])

  return {
    ...state,
    close,
    copySummary,
    exportReport,
    insertBelowSelection,
    open,
  }
}
