'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setAutoFreeze } from 'immer'
import { BarChart3, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { isCellProtected } from '@/features/protected-ranges/storage/localProtectedRanges'
import {
  cloneFortuneData,
  getCellFormulaBarValue,
  getCellFromSheet,
  getSheetMatrix,
  isSheetEmpty,
} from '@/lib/fortuneSheet'
import { isValidValue } from '@/lib/validation'
import { createDefaultSheet } from '@/lib/defaultSheet'
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, DEFAULT_COLS, DEFAULT_ROWS } from '@/lib/constants'
import { colIndexToLetter, fromCellNotation, toCellNotation } from '@/lib/cellAddress'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { FormulaTooltip, useFormulaExplainer } from '@/features/formula-explainer'
import { SmartPasteBanner, useSmartPaste } from '@/features/smart-paste'
import { PreviewOverlay, RangeHighlight, ResultBadge, useLivePreview } from '@/features/live-preview'
import { ColumnIntentBanner, useColumnIntent } from '@/features/intent-columns'
import { useInlineEditSync } from '../hooks/useInlineEditSync'
import type { RowSummarySelection } from '@/features/row-summarizer'
import type { Cell, Sheet, Selection } from '@fortune-sheet/core'
import type { WorkbookInstance } from '@fortune-sheet/react'
import type { CellData, FontFamily, NumberFormat } from '@/types/sheet.types'
import type { ComponentProps, ComponentType } from 'react'

setAutoFreeze(false)

const DEFAULT_FORMATTING = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  fontSize: 11,
  fontFamily: 'Inter' as FontFamily,
  textColor: '#000000',
  backgroundColor: '#ffffff',
  textAlign: 'left' as const,
  verticalAlign: 'bottom' as const,
  wrapText: false,
  numberFormat: 'general' as NumberFormat,
}

const GRID_ROW_HEADER_WIDTH = 46
const GRID_COLUMN_HEADER_HEIGHT = 20

type WorkbookComponentType = ComponentType<
  ComponentProps<typeof import('@fortune-sheet/react')['Workbook']> & {
    ref?: React.Ref<WorkbookInstance | null>
  }
>

interface SpreadsheetGridProps {
  workbookId?: string | null
  onOpenColumnDNA?: (columnIndex: number) => void
  onSummarizeRows?: (selection: RowSummarySelection) => void
  onViewCellHistory?: () => void
  onAddComment?: (target: { sheetId: string; cellAddress: string }) => void
}

function GridSkeleton() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="h-10 w-full animate-pulse border-b border-zinc-200 bg-zinc-100" />
      <div className="h-8 w-full animate-pulse border-b border-zinc-200 bg-zinc-50" />
      <div className="flex-1 w-full animate-pulse bg-white">
        <div className="grid h-full grid-cols-12 opacity-20">
          {Array.from({ length: 120 }).map((_, index) => (
            <div key={index} className="border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
      </div>
    </div>
  )
}

function mapNumberFormat(format?: string): NumberFormat {
  const normalized = format?.toLowerCase() ?? ''
  if (!normalized || normalized === 'general') return 'general'
  if (normalized === '@') return 'text'
  if (normalized.includes('%')) return 'percentage'
  if (normalized.includes('e+')) return 'scientific'
  if (normalized.includes('?/?')) return 'fraction'
  if (normalized.includes('mmmm')) return 'date_long'
  if (normalized.includes('mm/dd') || normalized.includes('yyyy')) return 'date_short'
  if (normalized.includes('hh') || normalized.includes('ss')) return 'time'
  if (normalized.includes('$')) return normalized.includes('#,##') ? 'accounting' : 'currency'
  if (normalized.includes('0.00') || normalized.includes('#,##')) return 'number'
  return 'general'
}

function stringifySheets(sheets: Sheet[]): string {
  return JSON.stringify(sheets)
}

function setIfChanged<T>(current: T, next: T, setter: (value: T) => void) {
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    setter(next)
  }
}

function normalizeCellHistoryValue(cell: Cell | null | undefined): string | null {
  const value = getCellFormulaBarValue(cell)
  return value === '' ? null : value
}

function historyValueToCellData(value: string | null): CellData {
  if (value && value.startsWith('=')) {
    return { value: null, formula: value }
  }

  return { value }
}

interface CellChangeForHistory {
  address: { row: number; col: number; sheet: number }
  cellAddress: string
  newData: CellData
  oldData: CellData
  sheetId: string
}

interface CellContextMenuState {
  left: number
  top: number
  row: number
  col: number
  sheetIndex: number
  rowSelection?: RowSummarySelection
}

interface HoveredColumnState {
  col: number
  left: number
  top: number
}

interface SelectedRowRangeState extends RowSummarySelection {
  left: number
  top: number
  rowCount: number
}

function getCellChangesForHistory(previousSheets: Sheet[], nextSheets: Sheet[]): CellChangeForHistory[] {
  const changes: CellChangeForHistory[] = []
  const sheetCount = Math.min(previousSheets.length, nextSheets.length)

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const previousSheet = previousSheets[sheetIndex]
    const nextSheet = nextSheets[sheetIndex]
    if (!previousSheet || !nextSheet) continue

    const sheetId = typeof nextSheet.id === 'string' ? nextSheet.id : `sheet-${sheetIndex}`
    const previousMatrix = getSheetMatrix(previousSheet)
    const nextMatrix = getSheetMatrix(nextSheet)
    const rowCount = Math.max(previousMatrix.length, nextMatrix.length)

    for (let row = 0; row < rowCount; row += 1) {
      const previousRow = previousMatrix[row] ?? []
      const nextRow = nextMatrix[row] ?? []
      const colCount = Math.max(previousRow.length, nextRow.length)

      for (let col = 0; col < colCount; col += 1) {
        const oldValue = normalizeCellHistoryValue(previousRow[col] ?? null)
        const newValue = normalizeCellHistoryValue(nextRow[col] ?? null)
        if (oldValue === newValue) continue

        changes.push({
          address: { row, col, sheet: sheetIndex },
          cellAddress: toCellNotation(row, col),
          oldData: historyValueToCellData(oldValue),
          newData: historyValueToCellData(newValue),
          sheetId,
        })
      }
    }
  }

  return changes
}

export function SpreadsheetGrid({
  workbookId = null,
  onOpenColumnDNA,
  onSummarizeRows,
  onViewCellHistory,
  onAddComment,
}: SpreadsheetGridProps) {
  const {
    gridSheets,
    replaceGridSheets,
    setGridInstance,
    setGridSheets,
    setSelectedCell,
    setSelectedRange,
    setFormulaBarValue,
    updateCell,
    resetFormatting,
    skipNextTabSync,
    setSkipNextTabSync,
    validationRules,
  } = useSheetStore()
  const { sheets: tabSheets, activeSheetId } = useWorkbookStore()

  const workbookRef = useRef<WorkbookInstance | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const gridSheetsRef = useRef(gridSheets)
  const validationRulesRef = useRef(validationRules)
  const lastProtectedToastRef = useRef<string>('')
  const hoverCellKeyRef = useRef<string | null>(null)
  const pendingHydrationRef = useRef(true)
  const isApplyingWorkbookChangeRef = useRef(false)
  const isSyncingToWorkbookRef = useRef(false)
  const pendingImperativeSyncRef = useRef<string | null>(null)
  const syncResetTimerRef = useRef<number | null>(null)
  const [WorkbookComponent, setWorkbookComponent] = useState<WorkbookComponentType | null>(null)
  const [contextMenu, setContextMenu] = useState<CellContextMenuState | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null)
  const [selectedRowRange, setSelectedRowRange] = useState<SelectedRowRangeState | null>(null)
  const formulaExplainer = useFormulaExplainer(gridSheets)
  const smartPaste = useSmartPaste()
  const livePreview = useLivePreview()
  const columnIntent = useColumnIntent(gridSheets)
  useInlineEditSync(gridContainerRef)

  useEffect(() => {
    gridSheetsRef.current = gridSheets
  }, [gridSheets])

  useEffect(() => {
    validationRulesRef.current = validationRules
  }, [validationRules])

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

  const handleWorkbookRef = useCallback(
    (instance: WorkbookInstance | null) => {
      if (workbookRef.current === instance) return
      workbookRef.current = instance
      window.setTimeout(() => {
        if (workbookRef.current === instance) {
          setGridInstance(instance)
        }
      }, 0)
    },
    [setGridInstance]
  )

  const workbookData = useMemo(() => cloneFortuneData(gridSheets), [gridSheets])
  const workbookStructureKey = useMemo(
    () =>
      gridSheets
        .map((sheet) => `${sheet.id}:${sheet.name}:${sheet.order}:${sheet.hide ?? 0}`)
        .join('|'),
    [gridSheets]
  )

  useEffect(() => {
    pendingHydrationRef.current = true
  }, [workbookStructureKey])

  useEffect(() => {
    if (skipNextTabSync) {
      setSkipNextTabSync(false)
      return
    }

    const previousSheets = new Map(
      gridSheetsRef.current
        .filter((sheet) => typeof sheet.id === 'string')
        .map((sheet) => [sheet.id as string, sheet])
    )

    const nextSheets: Sheet[] = [...tabSheets]
      .sort((left, right) => left.order - right.order)
      .map((tabSheet) => {
        const existing = previousSheets.get(tabSheet.id)
        const base = existing ?? createDefaultSheet(tabSheet.name, tabSheet.id)
        return {
          ...base,
          id: tabSheet.id,
          name: tabSheet.name,
          order: tabSheet.order,
          hide: tabSheet.isHidden ? 1 : 0,
          status: tabSheet.id === activeSheetId ? (1 as const) : (0 as const),
          ...(tabSheet.color ? { color: tabSheet.color } : {}),
        }
      })

    if (stringifySheets(nextSheets) === stringifySheets(gridSheetsRef.current)) {
      return
    }

    replaceGridSheets(nextSheets)
  }, [activeSheetId, replaceGridSheets, setSkipNextTabSync, skipNextTabSync, tabSheets])

  useEffect(() => {
    const instance = workbookRef.current
    if (!instance) return
    if (isApplyingWorkbookChangeRef.current) {
      isApplyingWorkbookChangeRef.current = false
      return
    }

    const syncData = cloneFortuneData(gridSheets)
    const syncKey = stringifySheets(syncData)
    const timer = window.setTimeout(() => {
      try {
        isSyncingToWorkbookRef.current = true
        pendingImperativeSyncRef.current = syncKey
        instance.updateSheet(syncData)
        if (activeSheetId) {
          instance.activateSheet({ id: activeSheetId })
        }
      } catch {
        // Let the mounted workbook keep running even if the imperative sync is rejected.
      } finally {
        if (syncResetTimerRef.current !== null) {
          window.clearTimeout(syncResetTimerRef.current)
        }
        syncResetTimerRef.current = window.setTimeout(() => {
          isSyncingToWorkbookRef.current = false
          pendingImperativeSyncRef.current = null
          syncResetTimerRef.current = null
        }, 100)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [activeSheetId, gridSheets])

  useEffect(
    () => () => {
      if (syncResetTimerRef.current !== null) {
        window.clearTimeout(syncResetTimerRef.current)
      }
    },
    []
  )

  const handleChange = useCallback(
    (data: Sheet[]) => {
      const incomingSheetsAreEmpty = data.every((sheet) => isSheetEmpty(sheet))
      const currentSheetsHaveData = gridSheetsRef.current.some((sheet) => !isSheetEmpty(sheet))
      const nextSheets = cloneFortuneData(data)
      const nextSheetsKey = stringifySheets(nextSheets)
      if (nextSheetsKey === stringifySheets(gridSheetsRef.current)) {
        if (pendingImperativeSyncRef.current === nextSheetsKey) {
          pendingImperativeSyncRef.current = null
        }
        return
      }

      if (isSyncingToWorkbookRef.current) {
        if (syncResetTimerRef.current !== null) {
          window.clearTimeout(syncResetTimerRef.current)
          syncResetTimerRef.current = null
        }
        isSyncingToWorkbookRef.current = false
        pendingImperativeSyncRef.current = null
        return
      }

      const matchesCurrentWorkbook =
        data.length === gridSheetsRef.current.length &&
        data.every((sheet, index) => {
          const currentSheet = gridSheetsRef.current[index]
          return currentSheet?.id === sheet.id && currentSheet?.name === sheet.name
        })

      if (incomingSheetsAreEmpty && currentSheetsHaveData && matchesCurrentWorkbook) {
        pendingHydrationRef.current = false
        return
      }

      if (pendingHydrationRef.current) {
        pendingHydrationRef.current = false

        if (incomingSheetsAreEmpty && currentSheetsHaveData) {
          return
        }
      }

      getCellChangesForHistory(gridSheetsRef.current, nextSheets).forEach((change) => {
        updateCell(change.address, change.newData, change.oldData, {
          workbookId,
          sheetId: change.sheetId,
          cellAddress: change.cellAddress,
        })
      })

      isApplyingWorkbookChangeRef.current = true
      setGridSheets(nextSheets)
    },
    [setGridSheets, updateCell, workbookId]
  )

  const hooks = useMemo(
    () => ({
      beforeUpdateCell: (row: number, col: number, value: unknown) => {
        const currentSheetId = useWorkbookStore.getState().activeSheetId

        // ── Protected ranges check ────────────────────────────────────
        if (workbookId && currentSheetId && isCellProtected(workbookId, currentSheetId, row, col)) {
          // single toast per attempt — and dedupe by stamping a ref so a
          // single keystroke doesn't fire 3 toasts.
          const stamp = `${currentSheetId}:${row}:${col}:${Date.now() >> 11}` // ~2s window
          if (lastProtectedToastRef.current !== stamp) {
            lastProtectedToastRef.current = stamp
            toast.error(`${toCellNotation(row, col)} is in a protected range and can't be edited.`)
          }
          return false
        }

        const key = `${currentSheetId}:${row}:${col}`
        const validation = validationRulesRef.current[key]
        const sheetIndex = gridSheetsRef.current.findIndex((sheet) => sheet.id === currentSheetId)
        const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : 0

        if (
          isValidValue(value, validation, {
            sheets: gridSheetsRef.current,
            sheetIndex: resolvedSheetIndex,
            row,
            col,
          })
        ) {
          return true
        }

        window.alert(validation?.errorMessage || 'The value does not match the validation rule.')
        return false
      },

      afterSelectionChange: (sheetId: string, selection: Selection) => {
        const row = selection.row[0]
        const col = selection.column[0]
        if (row === undefined || col === undefined) return

        const sheetIndex = gridSheetsRef.current.findIndex((sheet) => sheet.id === sheetId)
        const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : 0
        const rowEnd = selection.row[1] ?? row
        const colEnd = selection.column[1] ?? col

        const nextSelectedCell = { row, col, sheet: resolvedSheetIndex }
        const nextSelectedRange = {
          start: {
            row: Math.min(row, rowEnd),
            col: Math.min(col, colEnd),
            sheet: resolvedSheetIndex,
          },
          end: {
            row: Math.max(row, rowEnd),
            col: Math.max(col, colEnd),
            sheet: resolvedSheetIndex,
          },
        }
        const sheetState = useSheetStore.getState()

        setIfChanged(sheetState.selectedCell, nextSelectedCell, setSelectedCell)
        setIfChanged(sheetState.selectedRange, nextSelectedRange, setSelectedRange)

        const sheet = gridSheetsRef.current[resolvedSheetIndex]
        const sheetColumnCount = Math.max(sheet?.column ?? DEFAULT_COLS, DEFAULT_COLS)
        const rowStart = Math.min(row, rowEnd)
        const normalizedRowEnd = Math.max(row, rowEnd)
        const colStart = Math.min(col, colEnd)
        const normalizedColEnd = Math.max(col, colEnd)
        const isCompleteRowSelection =
          selection.row_select === true ||
          (colStart === 0 && normalizedColEnd >= sheetColumnCount - 1)

        const selectedRowCount = normalizedRowEnd - rowStart + 1
        if (isCompleteRowSelection && normalizedRowEnd > rowStart && selectedRowCount < DEFAULT_ROWS) {
          setSelectedRowRange({
            sheetIndex: resolvedSheetIndex,
            startRow: rowStart,
            endRow: normalizedRowEnd,
            rowCount: selectedRowCount,
            left: GRID_ROW_HEADER_WIDTH + 8,
            top: Math.max(4, GRID_COLUMN_HEADER_HEIGHT + rowStart * DEFAULT_CELL_HEIGHT - 38),
          })
        } else {
          setSelectedRowRange(null)
        }

        const cell = sheet ? getCellFromSheet(sheet, row, col) : null
        const nextFormulaBarValue = getCellFormulaBarValue(cell)
        if (sheetState.formulaBarValue !== nextFormulaBarValue) {
          sheetState.setFormulaBarValue(nextFormulaBarValue)
        }

        if (!cell) {
          if (JSON.stringify(sheetState.activeFormatting) !== JSON.stringify(DEFAULT_FORMATTING)) {
            resetFormatting()
          }
          return
        }

        const nextFormatting = {
          bold: cell.bl === 1,
          italic: cell.it === 1,
          underline: cell.un === 1,
          strikethrough: cell.cl === 1,
          fontSize: typeof cell.fs === 'number' ? cell.fs : 11,
          fontFamily: typeof cell.ff === 'string' ? (cell.ff as FontFamily) : 'Inter',
          textColor: typeof cell.fc === 'string' ? cell.fc : '#000000',
          backgroundColor: typeof cell.bg === 'string' ? cell.bg : '#ffffff',
          textAlign: cell.ht === 0 ? 'center' : cell.ht === 2 ? 'right' : 'left',
          verticalAlign: cell.vt === 1 ? 'top' : cell.vt === 0 ? 'middle' : 'bottom',
          wrapText: cell.tb === '2',
          numberFormat: mapNumberFormat(cell.ct?.fa),
        } as const

        setIfChanged(sheetState.activeFormatting, nextFormatting, sheetState.setActiveFormatting)
      },
    }),
    [resetFormatting, setSelectedCell, setSelectedRange, workbookId]
  )

  const getCellAddressFromPointer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = gridContainerRef.current?.getBoundingClientRect()
      if (!rect) return null

      const x = event.clientX - rect.left - GRID_ROW_HEADER_WIDTH
      const y = event.clientY - rect.top - GRID_COLUMN_HEADER_HEIGHT
      if (x < 0 || y < 0) return null

      const col = Math.floor(x / DEFAULT_CELL_WIDTH)
      const row = Math.floor(y / DEFAULT_CELL_HEIGHT)
      const sheetIndex = gridSheetsRef.current.findIndex((sheet) => sheet.id === activeSheetId)
      const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : 0
      const sheet = gridSheetsRef.current[resolvedSheetIndex]
      if (!sheet) return null

      return {
        row,
        col,
        sheetIndex: resolvedSheetIndex,
        anchor: {
          left: rect.left + GRID_ROW_HEADER_WIDTH + col * DEFAULT_CELL_WIDTH,
          top: rect.top + GRID_COLUMN_HEADER_HEIGHT + (row + 1) * DEFAULT_CELL_HEIGHT + 8,
        },
      }
    },
    [activeSheetId]
  )

  const getRowHeaderFromPointer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = gridContainerRef.current?.getBoundingClientRect()
      if (!rect) return null

      const x = event.clientX - rect.left
      const y = event.clientY - rect.top - GRID_COLUMN_HEADER_HEIGHT
      if (x < 0 || x > GRID_ROW_HEADER_WIDTH || y < 0) return null

      const row = Math.floor(y / DEFAULT_CELL_HEIGHT)
      const sheetIndex = gridSheetsRef.current.findIndex((sheet) => sheet.id === activeSheetId)
      return {
        row,
        sheetIndex: sheetIndex >= 0 ? sheetIndex : 0,
      }
    },
    [activeSheetId]
  )

  const getFormulaCellFromPointer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const cellAddress = getCellAddressFromPointer(event)
      if (!cellAddress) return null

      const sheet = gridSheetsRef.current[cellAddress.sheetIndex]
      if (!sheet) return null

      const cell = getCellFromSheet(sheet, cellAddress.row, cellAddress.col)
      const formula = getCellFormulaBarValue(cell)
      if (!formula.startsWith('=')) return null

      return {
        row: cellAddress.row,
        col: cellAddress.col,
        sheetIndex: cellAddress.sheetIndex,
        formula,
        anchor: cellAddress.anchor,
      }
    },
    [getCellAddressFromPointer]
  )

  const updateHoveredColumn = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onOpenColumnDNA) return

      const rect = gridContainerRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = event.clientX - rect.left - GRID_ROW_HEADER_WIDTH
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || y > GRID_COLUMN_HEADER_HEIGHT) {
        setHoveredColumn(null)
        return
      }

      const col = Math.floor(x / DEFAULT_CELL_WIDTH)
      setHoveredColumn((current) => {
        if (current?.col === col) return current

        return {
          col,
          left: GRID_ROW_HEADER_WIDTH + col * DEFAULT_CELL_WIDTH + DEFAULT_CELL_WIDTH - 24,
          top: 2,
        }
      })
    },
    [onOpenColumnDNA]
  )

  const handleCellHover = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      updateHoveredColumn(event)

      const formulaCell = getFormulaCellFromPointer(event)
      const key = formulaCell
        ? `${formulaCell.sheetIndex}:${formulaCell.row}:${formulaCell.col}:${formulaCell.formula}`
        : null

      if (hoverCellKeyRef.current === key) return
      hoverCellKeyRef.current = key
      formulaExplainer.handleCellHover(formulaCell)
    },
    [formulaExplainer, getFormulaCellFromPointer, updateHoveredColumn]
  )

  const handleGridMouseLeave = useCallback(() => {
    hoverCellKeyRef.current = null
    setHoveredColumn(null)
    formulaExplainer.handleMouseLeave()
  }, [formulaExplainer])

  const handleCellRightClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rowHeader = getRowHeaderFromPointer(event)
      if (
        rowHeader &&
        selectedRowRange &&
        selectedRowRange.sheetIndex === rowHeader.sheetIndex &&
        rowHeader.row >= selectedRowRange.startRow &&
        rowHeader.row <= selectedRowRange.endRow
      ) {
        event.preventDefault()
        event.stopPropagation()
        setContextMenu({
          left: event.clientX,
          top: event.clientY,
          row: rowHeader.row,
          col: 0,
          sheetIndex: rowHeader.sheetIndex,
          rowSelection: selectedRowRange,
        })
        return
      }

      const cellAddress = getCellAddressFromPointer(event)
      if (!cellAddress) return

      event.preventDefault()
      event.stopPropagation()
      const rightClickedSelectedRows =
        selectedRowRange &&
        selectedRowRange.sheetIndex === cellAddress.sheetIndex &&
        cellAddress.row >= selectedRowRange.startRow &&
        cellAddress.row <= selectedRowRange.endRow

      if (!rightClickedSelectedRows) {
        const nextSelectedCell = {
          row: cellAddress.row,
          col: cellAddress.col,
          sheet: cellAddress.sheetIndex,
        }
        setSelectedCell(nextSelectedCell)
        setSelectedRange({
          start: nextSelectedCell,
          end: nextSelectedCell,
        })
        setSelectedRowRange(null)

        const sheet = gridSheetsRef.current[cellAddress.sheetIndex]
        const cell = sheet ? getCellFromSheet(sheet, cellAddress.row, cellAddress.col) : null
        setFormulaBarValue(getCellFormulaBarValue(cell))

        try {
          workbookRef.current?.setSelection(
            [{ row: [cellAddress.row, cellAddress.row], column: [cellAddress.col, cellAddress.col] }],
            { id: activeSheetId }
          )
        } catch {
          // Selection state above is still enough for the history panel.
        }
      }

      setContextMenu({
        left: event.clientX,
        top: event.clientY,
        row: cellAddress.row,
        col: cellAddress.col,
        sheetIndex: cellAddress.sheetIndex,
        ...(rightClickedSelectedRows ? { rowSelection: selectedRowRange } : {}),
      })
    },
    [
      activeSheetId,
      getCellAddressFromPointer,
      getRowHeaderFromPointer,
      selectedRowRange,
      setFormulaBarValue,
      setSelectedCell,
      setSelectedRange,
    ]
  )

  useEffect(() => {
    if (!contextMenu) return

    const handlePointerDown = (event: MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!onSummarizeRows) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true
      if (isTypingTarget || event.altKey !== true || event.key.toLowerCase() !== 's') return
      if (!selectedRowRange || selectedRowRange.rowCount < 2) return

      event.preventDefault()
      onSummarizeRows(selectedRowRange)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSummarizeRows, selectedRowRange])

  const getDependencyOverlay = useCallback((reference: string) => {
    const [start, end] = reference.split(':')
    if (!start) return null

    try {
      const startCell = fromCellNotation(start)
      const endCell = end ? fromCellNotation(end) : startCell
      const startRow = Math.min(startCell.row, endCell.row)
      const endRow = Math.max(startCell.row, endCell.row)
      const startCol = Math.min(startCell.col, endCell.col)
      const endCol = Math.max(startCell.col, endCell.col)

      return {
        left: GRID_ROW_HEADER_WIDTH + startCol * DEFAULT_CELL_WIDTH,
        top: GRID_COLUMN_HEADER_HEIGHT + startRow * DEFAULT_CELL_HEIGHT,
        width: (endCol - startCol + 1) * DEFAULT_CELL_WIDTH,
        height: (endRow - startRow + 1) * DEFAULT_CELL_HEIGHT,
      }
    } catch {
      return null
    }
  }, [])

  const getActiveCellPosition = useCallback(() => {
    const cell = useSheetStore.getState().editingCell
    if (!cell) return null

    return {
      left: GRID_ROW_HEADER_WIDTH + cell.col * DEFAULT_CELL_WIDTH,
      top: GRID_COLUMN_HEADER_HEIGHT + cell.row * DEFAULT_CELL_HEIGHT,
      width: DEFAULT_CELL_WIDTH,
      height: DEFAULT_CELL_HEIGHT,
    }
  }, [])

  return (
    <div
      ref={gridContainerRef}
      className="relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-zinc-900"
      onMouseMove={handleCellHover}
      onMouseLeave={handleGridMouseLeave}
      onContextMenu={handleCellRightClick}
      onPaste={smartPaste.handlePaste}
    >
      {smartPaste.state && (
        <SmartPasteBanner
          columns={smartPaste.state.columns}
          detectedStructure={smartPaste.state.detectedStructure}
          isApplying={smartPaste.isApplying}
          onConfirm={smartPaste.confirm}
          onKeepRaw={smartPaste.dismiss}
          onEditDetection={smartPaste.editDetection}
          onDismiss={smartPaste.dismiss}
        />
      )}

      {columnIntent.pendingIntent && (
        <ColumnIntentBanner
          intent={columnIntent.pendingIntent.intent}
          header={columnIntent.pendingIntent.header}
          position={columnIntent.pendingIntent.position}
          onKeep={columnIntent.confirm}
          onChange={columnIntent.change}
          onDismiss={columnIntent.dismiss}
        />
      )}

      {selectedRowRange && onSummarizeRows && (
        <div
          style={{ left: selectedRowRange.left, top: selectedRowRange.top }}
          className="absolute z-[86] flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-blue-900/70 dark:bg-zinc-800"
        >
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {selectedRowRange.rowCount} rows selected
          </span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSummarizeRows(selectedRowRange)}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Summarize rows
          </button>
        </div>
      )}

      {WorkbookComponent ? (
        <WorkbookComponent
          key={workbookStructureKey}
          ref={handleWorkbookRef}
          data={workbookData}
          onChange={handleChange}
          showToolbar={false}
          showFormulaBar={false}
          showSheetTabs={false}
          allowEdit={true}
          lang="en"
          hooks={hooks}
        />
      ) : (
        <GridSkeleton />
      )}

      {livePreview.isValid && (
        <RangeHighlight
          references={livePreview.references}
          rowHeaderWidth={GRID_ROW_HEADER_WIDTH}
          columnHeaderHeight={GRID_COLUMN_HEADER_HEIGHT}
        />
      )}

      {livePreview.isValid && getActiveCellPosition() && (
        <PreviewOverlay
          previewValue={livePreview.previewValue}
          position={getActiveCellPosition()!}
        />
      )}

      <ResultBadge previewValue={livePreview.previewValue} isValid={livePreview.isValid} />

      {formulaExplainer.shouldShow &&
        formulaExplainer.dependencies.map((dependency) => {
          const overlay = getDependencyOverlay(dependency)
          if (!overlay) return null

          return (
            <div
              key={dependency}
              style={overlay}
              className="pointer-events-none absolute z-[40] border border-blue-400 bg-blue-400/10"
            />
          )
        })}

      {formulaExplainer.shouldShow && formulaExplainer.hoveredCell && (
        <FormulaTooltip
          formula={formulaExplainer.hoveredCell.formula}
          explanation={formulaExplainer.explanation?.explanation ?? ''}
          dependencies={formulaExplainer.dependencies}
          sensitivityNote={formulaExplainer.explanation?.sensitivityNote ?? ''}
          isLoading={formulaExplainer.isLoading}
          isPinned={formulaExplainer.isPinned}
          position={formulaExplainer.hoveredCell.anchor}
          onPinToggle={formulaExplainer.togglePin}
          onDependencyClick={(reference) => {
            if (reference.includes(':')) return
            try {
              const cell = fromCellNotation(reference)
              workbookRef.current?.setSelection(
                [{ row: [cell.row, cell.row], column: [cell.col, cell.col] }],
                { id: activeSheetId }
              )
            } catch {
              // Ignore malformed dependency chips from AI output.
            }
          }}
        />
      )}

      {hoveredColumn && onOpenColumnDNA && (
        <button
          type="button"
          title={`Analyze column ${colIndexToLetter(hoveredColumn.col)}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenColumnDNA(hoveredColumn.col)
          }}
          style={{ left: hoveredColumn.left, top: hoveredColumn.top }}
          className="absolute z-[65] flex h-5 w-5 items-center justify-center rounded border border-blue-200 bg-white text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
        >
          <BarChart3 className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ left: contextMenu.left, top: contextMenu.top }}
          className="fixed z-[70] min-w-[200px] rounded-md border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
        >
          {contextMenu.rowSelection && onSummarizeRows && (
            <button
              type="button"
              onClick={() => {
                const rowSelection = contextMenu.rowSelection
                setContextMenu(null)
                if (rowSelection) {
                  onSummarizeRows(rowSelection)
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Summarize selected rows
            </button>
          )}
          {onAddComment && (
            <button
              type="button"
              onClick={() => {
                const target = contextMenu
                setContextMenu(null)
                if (target && activeSheetId) {
                  onAddComment({
                    sheetId: activeSheetId,
                    cellAddress: toCellNotation(target.row, target.col),
                  })
                }
              }}
              className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Add comment
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setContextMenu(null)
              onViewCellHistory?.()
            }}
            className="flex w-full items-center px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            View Cell History
          </button>
        </div>
      )}
    </div>
  )
}
