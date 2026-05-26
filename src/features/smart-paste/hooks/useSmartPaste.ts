'use client'

import { useCallback, useMemo, useState } from 'react'
import { cloneSheetWithData, getSheetMatrix } from '@/lib/fortuneSheet'
import { toCellNotation } from '@/lib/cellAddress'
import { parseClipboardText } from '@/features/smart-paste/utils/clipboardParser'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { Cell, Sheet } from '@fortune-sheet/core'
import type { ActiveFormatting, NumberFormat } from '@/types/sheet.types'

export type SmartPasteColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'boolean'

export interface SmartPasteColumn {
  name: string
  type: SmartPasteColumnType
  format: string
  sampleValues: string[]
}

interface SmartPasteDetection {
  columns: SmartPasteColumn[]
  detectedStructure: string
}

interface SmartPasteState extends SmartPasteDetection {
  rows: string[][]
  pastePosition: { row: number; col: number; sheet: number }
}

const TYPE_FORMAT: Record<SmartPasteColumnType, Partial<ActiveFormatting>> = {
  text: { numberFormat: 'text' },
  number: { numberFormat: 'number' },
  currency: { numberFormat: 'currency' },
  date: { numberFormat: 'date_short' },
  email: { numberFormat: 'text', textColor: '#2563eb', underline: true },
  phone: { numberFormat: 'text' },
  url: { numberFormat: 'text', textColor: '#2563eb', underline: true },
  boolean: { numberFormat: 'text', textAlign: 'center' },
}

function looksLikeHeader(row: string[], columns: SmartPasteColumn[]): boolean {
  if (row.length === 0 || columns.length === 0) return false
  return columns.some((column, index) => {
    const value = row[index]?.trim().toLowerCase()
    return value && value === column.name.trim().toLowerCase()
  })
}

function inferColumnType(values: string[]): SmartPasteColumnType {
  const samples = values.map((value) => value.trim()).filter(Boolean)
  if (samples.length === 0) return 'text'

  const tests: Array<[SmartPasteColumnType, RegExp]> = [
    ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    ['url', /^https?:\/\//i],
    ['currency', /^[₹$€£]?\s?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/],
    ['date', /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/],
    ['phone', /^\+?[\d\s().-]{7,}$/],
    ['boolean', /^(true|false|yes|no)$/i],
    ['number', /^-?\d+(?:,\d{3})*(?:\.\d+)?$/],
  ]

  for (const [type, pattern] of tests) {
    if (samples.every((sample) => pattern.test(sample))) return type
  }

  return 'text'
}

function buildLocalDetection(rows: string[][], structure: string): SmartPasteDetection {
  const width = Math.max(...rows.map((row) => row.length), 0)
  const firstRow = rows[0] ?? []
  const hasHeader = firstRow.some((cell) => /[A-Za-z]/.test(cell))

  return {
    detectedStructure: structure,
    columns: Array.from({ length: width }, (_, colIndex) => {
      const values = rows.slice(hasHeader ? 1 : 0).map((row) => row[colIndex] ?? '')
      const type = inferColumnType(values)
      return {
        name: hasHeader && firstRow[colIndex]?.trim() ? firstRow[colIndex]!.trim() : `Column ${colIndex + 1}`,
        type,
        format: type,
        sampleValues: values.filter(Boolean).slice(0, 5),
      }
    }),
  }
}

function formatToCellStyle(formatting: Partial<ActiveFormatting>): Partial<Cell> {
  const style: Partial<Cell> = {}
  if (formatting.underline !== undefined) style.un = formatting.underline ? 1 : 0
  if (formatting.textColor !== undefined) style.fc = formatting.textColor
  if (formatting.textAlign !== undefined) {
    style.ht = formatting.textAlign === 'center' ? 0 : formatting.textAlign === 'right' ? 2 : 1
  }

  const format = formatting.numberFormat
  if (format && format !== 'general') {
    const formatMap: Record<NumberFormat, string> = {
      general: 'General',
      number: '0.00',
      currency: '$0.00',
      accounting: '$#,##0.00',
      percentage: '0.00%',
      fraction: '# ??/??',
      scientific: '0.00E+00',
      text: '@',
      date_short: 'MM/DD/YYYY',
      date_long: 'MMMM D, YYYY',
      time: 'HH:mm:ss',
    }
    style.ct = { fa: formatMap[format], t: format === 'text' ? 's' : 'n' }
  }

  return style
}

function applyColumnFormats(
  sheets: Sheet[],
  state: SmartPasteState,
  activeSheetId: string
): Sheet[] {
  const sheetIndex = sheets.findIndex((sheet) => sheet.id === activeSheetId)
  const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : state.pastePosition.sheet
  const activeSheet = sheets[resolvedSheetIndex]
  if (!activeSheet) return sheets

  const data = getSheetMatrix(activeSheet)
  const nextData = data.map((row) => [...(row ?? [])])
  const skipHeader = looksLikeHeader(state.rows[0] ?? [], state.columns)
  const rowCount = Math.max(state.rows.length, 1)

  state.columns.forEach((column, colOffset) => {
    const formatting = TYPE_FORMAT[column.type] ?? TYPE_FORMAT.text
    const style = formatToCellStyle(formatting)
    const targetCol = state.pastePosition.col + colOffset

    for (let rowOffset = skipHeader ? 1 : 0; rowOffset < rowCount; rowOffset += 1) {
      const targetRow = state.pastePosition.row + rowOffset
      if (!nextData[targetRow]) nextData[targetRow] = []
      const existing = (nextData[targetRow]![targetCol] ?? null) as Cell | null
      nextData[targetRow]![targetCol] = { ...(existing ?? {}), ...style }
    }
  })

  return sheets.map((sheet, index) =>
    index === resolvedSheetIndex ? cloneSheetWithData(sheet, nextData) : sheet
  )
}

export function useSmartPaste() {
  const { activeSheetId } = useWorkbookStore()
  const [state, setState] = useState<SmartPasteState | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLElement>) => {
      const rawText = event.clipboardData.getData('text/plain')
      const parsed = parseClipboardText(rawText)
      if (parsed.rows.length === 0 || parsed.confidence <= 0.7) return

      const sheetState = useSheetStore.getState()
      const selectedCell = sheetState.selectedCell ?? { row: 0, col: 0, sheet: 0 }
      const localDetection = buildLocalDetection(parsed.rows, parsed.type)
      const pastePosition = toCellNotation(selectedCell.row, selectedCell.col)

      setState({
        ...localDetection,
        rows: parsed.rows,
        pastePosition: selectedCell,
      })

      try {
        const response = await fetch('/api/ai/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText, pastePosition }),
        })

        if (!response.ok) return
        const detection = (await response.json()) as Partial<SmartPasteDetection>
        if (!Array.isArray(detection.columns) || detection.columns.length === 0) return

        setState({
          columns: detection.columns,
          detectedStructure: detection.detectedStructure ?? localDetection.detectedStructure,
          rows: parsed.rows,
          pastePosition: selectedCell,
        })
      } catch {
        // Keep the fast local detection if AI analysis is unavailable.
      }
    },
    []
  )

  const dismiss = useCallback(() => {
    setState(null)
    setIsApplying(false)
  }, [])

  const confirm = useCallback(() => {
    if (!state) return
    setIsApplying(true)

    const sheetState = useSheetStore.getState()
    state.columns.forEach((column) => {
      sheetState.setActiveFormatting(TYPE_FORMAT[column.type] ?? TYPE_FORMAT.text)
    })
    sheetState.setGridSheets(applyColumnFormats(sheetState.gridSheets, state, activeSheetId))
    setState(null)
    setIsApplying(false)
  }, [activeSheetId, state])

  const editDetection = useCallback(() => {
    if (!state) return
    const snapshot = state
    void (async () => {
      const { promptDialog } = await import('@/components/PromptDialog')
      const edited = await promptDialog({
        title: 'Edit detected columns',
        message: 'Comma-separated column names. We\'ll pair them positionally with the pasted data.',
        defaultValue: snapshot.columns.map((column) => column.name).join(', '),
      })
      if (!edited) return

      const names = edited
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)

      setState({
        ...snapshot,
        columns: snapshot.columns.map((column, index) => ({
          ...column,
          name: names[index] ?? column.name,
        })),
      })
    })()
  }, [state])

  return useMemo(
    () => ({
      state,
      isApplying,
      handlePaste,
      confirm,
      dismiss,
      editDetection,
    }),
    [confirm, dismiss, editDetection, handlePaste, isApplying, state]
  )
}
