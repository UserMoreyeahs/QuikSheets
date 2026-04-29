'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Cell, CellMatrix, Sheet, Selection } from '@fortune-sheet/core'
import type { WorkbookInstance } from '@fortune-sheet/react'
import type { ComponentProps, ComponentType } from 'react'
import { colIndexToLetter } from '@/lib/cellAddress'
import {
  cloneFortuneData,
  cloneSheetWithData,
  getCellFormulaBarValue,
  getSheetMatrix,
} from '@/lib/fortuneSheet'
import { resolveCrossReferenceFormula } from '@/features/scratchpad/utils/crossReference'

const SCRATCHPAD_ROWS = 100
const SCRATCHPAD_COLUMNS = 20

type WorkbookComponentType = ComponentType<
  ComponentProps<typeof import('@fortune-sheet/react')['Workbook']> & {
    ref?: React.Ref<WorkbookInstance | null>
  }
>

interface ScratchpadGridProps {
  data: Sheet[]
  mainSheetData: Sheet | null | undefined
  onChange: (data: Sheet[]) => void
}

interface SelectedCell {
  row: number
  col: number
}

function createResolvedCell(value: string | number | boolean | null): Cell | null {
  if (value === null || value === '') return null

  return {
    v: value,
    m: typeof value === 'boolean' ? String(value).toUpperCase() : String(value),
  }
}

function createCellFromInput(value: string, mainSheetData: Sheet | null | undefined): Cell | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null

  const resolvedReference = resolveCrossReferenceFormula(trimmedValue, mainSheetData)
  if (resolvedReference !== undefined) {
    return createResolvedCell(resolvedReference)
  }

  if (trimmedValue.startsWith('=')) {
    return { f: trimmedValue.slice(1) }
  }

  return createResolvedCell(value)
}

function normalizeMatrix(sheet: Sheet): CellMatrix {
  const matrix = getSheetMatrix(sheet)

  return Array.from({ length: SCRATCHPAD_ROWS }, (_, rowIndex) =>
    Array.from({ length: SCRATCHPAD_COLUMNS }, (_, colIndex) => matrix[rowIndex]?.[colIndex] ?? null)
  )
}

function resolveCrossReferenceCell(
  cell: Cell | null,
  mainSheetData: Sheet | null | undefined
): Cell | null {
  if (!cell) return null

  const formula = cell.f ? `=${cell.f}` : typeof cell.v === 'string' ? cell.v : ''
  const resolvedReference = formula
    ? resolveCrossReferenceFormula(formula, mainSheetData)
    : undefined

  if (resolvedReference === undefined) return cell
  return createResolvedCell(resolvedReference)
}

function normalizeScratchpadData(
  sheets: Sheet[],
  mainSheetData: Sheet | null | undefined
): Sheet[] {
  const sheet = sheets[0]
  if (!sheet) return sheets

  const matrix = normalizeMatrix(sheet).map((row) =>
    row.map((cell) => resolveCrossReferenceCell(cell, mainSheetData))
  )

  return [
    {
      ...cloneSheetWithData(sheet, matrix),
      order: 0,
      status: 1,
      hide: 0,
      row: SCRATCHPAD_ROWS,
      column: SCRATCHPAD_COLUMNS,
    },
  ]
}

function GridSkeleton() {
  return (
    <div className="h-full w-full animate-pulse bg-zinc-50">
      <div className="grid h-full grid-cols-8 opacity-40">
        {Array.from({ length: 80 }).map((_, index) => (
          <div key={index} className="border border-zinc-100 bg-white" />
        ))}
      </div>
    </div>
  )
}

export function ScratchpadGrid({ data, mainSheetData, onChange }: ScratchpadGridProps) {
  const [WorkbookComponent, setWorkbookComponent] = useState<WorkbookComponentType | null>(null)
  const [selectedCell, setSelectedCell] = useState<SelectedCell>({ row: 0, col: 0 })
  const [formulaBarValue, setFormulaBarValue] = useState('')
  const workbookRef = useRef<WorkbookInstance | null>(null)
  const dataRef = useRef(data)
  const isSyncingToWorkbookRef = useRef(false)
  const syncResetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(
    () => () => {
      if (syncResetTimerRef.current !== null) {
        window.clearTimeout(syncResetTimerRef.current)
      }
    },
    []
  )

  useEffect(() => {
    let isMounted = true

    import('@fortune-sheet/react').then((mod) => {
      if (isMounted) {
        setWorkbookComponent(() => mod.Workbook as unknown as WorkbookComponentType)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const updateFormulaBarFromSelection = useCallback((row: number, col: number) => {
    const cell = getSheetMatrix(dataRef.current[0] ?? ({} as Sheet))[row]?.[col] ?? null
    setFormulaBarValue(getCellFormulaBarValue(cell))
  }, [])

  const handleWorkbookRef = useCallback((instance: WorkbookInstance | null) => {
    workbookRef.current = instance
  }, [])

  useEffect(() => {
    const instance = workbookRef.current
    if (!instance) return

    const syncTimer = window.setTimeout(() => {
      try {
        isSyncingToWorkbookRef.current = true
        instance.updateSheet(cloneFortuneData(data))
      } catch {
        // The local state remains the source of truth if FortuneSheet rejects an update.
      } finally {
        if (syncResetTimerRef.current !== null) {
          window.clearTimeout(syncResetTimerRef.current)
        }
        syncResetTimerRef.current = window.setTimeout(() => {
          isSyncingToWorkbookRef.current = false
          syncResetTimerRef.current = null
        }, 100)
      }
    }, 0)

    return () => window.clearTimeout(syncTimer)
  }, [data])

  const hooks = useMemo(
    () => ({
      afterSelectionChange: (_sheetId: string, selection: Selection) => {
        const row = selection.row[0]
        const col = selection.column[0]
        if (row === undefined || col === undefined) return

        setSelectedCell({ row, col })
        updateFormulaBarFromSelection(row, col)
      },
    }),
    [updateFormulaBarFromSelection]
  )

  const commitFormulaBarValue = useCallback(() => {
    const currentSheet = dataRef.current[0]
    if (!currentSheet) return

    const nextSheets = cloneFortuneData(dataRef.current)
    const sheet = nextSheets[0]
    if (!sheet) return

    const matrix = normalizeMatrix(sheet)
    matrix[selectedCell.row]![selectedCell.col] = createCellFromInput(formulaBarValue, mainSheetData)

    onChange(
      normalizeScratchpadData(
        [
          {
            ...cloneSheetWithData(sheet, matrix),
            row: SCRATCHPAD_ROWS,
            column: SCRATCHPAD_COLUMNS,
          },
        ],
        mainSheetData
      )
    )
  }, [formulaBarValue, mainSheetData, onChange, selectedCell.col, selectedCell.row])

  const handleChange = useCallback(
    (nextData: Sheet[]) => {
      if (isSyncingToWorkbookRef.current) return

      const normalizedData = normalizeScratchpadData(nextData, mainSheetData)
      onChange(normalizedData)
    },
    [mainSheetData, onChange]
  )

  const workbookKey = useMemo(
    () => data.map((sheet) => `${sheet.id}:${sheet.name}:${sheet.row}:${sheet.column}`).join('|'),
    [data]
  )
  const selectedAddress = `${colIndexToLetter(selectedCell.col)}${selectedCell.row + 1}`

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3">
        <span className="w-10 rounded border border-zinc-200 bg-white px-1.5 py-1 text-center font-mono text-[11px] font-semibold text-zinc-500">
          {selectedAddress}
        </span>
        <span className="font-mono text-xs font-semibold text-zinc-400">fx</span>
        <input
          type="text"
          value={formulaBarValue}
          onChange={(event) => setFormulaBarValue(event.target.value)}
          onBlur={commitFormulaBarValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitFormulaBarValue()
              event.currentTarget.blur()
            }
          }}
          className="min-w-0 flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-blue-400 focus:bg-blue-50"
          placeholder="Type notes or =MAIN!A1"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {WorkbookComponent ? (
          <WorkbookComponent
            key={workbookKey}
            ref={handleWorkbookRef}
            data={data}
            onChange={handleChange}
            showToolbar={false}
            showFormulaBar={true}
            showSheetTabs={false}
            allowEdit={true}
            lang="en"
            hooks={hooks}
          />
        ) : (
          <GridSkeleton />
        )}
      </div>
    </div>
  )
}
