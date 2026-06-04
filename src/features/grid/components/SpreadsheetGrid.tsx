'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setAutoFreeze } from 'immer'
import { BarChart3 } from 'lucide-react'
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
import { useShallow } from 'zustand/react/shallow'
import { useWorkbookStore } from '@/store/workbookStore'
import { FormulaTooltip, useFormulaExplainer } from '@/features/formula-explainer'
import { SmartPasteBanner, useSmartPaste } from '@/features/smart-paste'
import { PreviewOverlay, RangeHighlight, ResultBadge, useLivePreview } from '@/features/live-preview'
import { ColumnIntentBanner, useColumnIntent } from '@/features/intent-columns'
import { useColumnTypesStore, validateForEdit } from '@/features/typed-columns'
import { useInlineEditSync } from '../hooks/useInlineEditSync'
import { CellContextMenu } from './CellContextMenu'
import { insertHyperlink, defineNameFromSelection } from '@/features/ribbon/utils/cellOps'
import { fireTrigger, buildEvent } from '@/features/automation/triggerClient'
import { useAutomationStore } from '@/features/automation/store/automationStore'
import type { RowSummarySelection } from '@/features/row-summarizer'
import type { Sheet, Selection } from '@fortune-sheet/core'
import type { WorkbookInstance } from '@fortune-sheet/react'
import type { FontFamily } from '@/types/sheet.types'
import type { ComponentProps, ComponentType } from 'react'
// Wave 4 extraction — pure helpers + skeleton + floater moved to focused files.
import {
  DEFAULT_FORMATTING,
  GRID_ROW_HEADER_WIDTH,
  GRID_COLUMN_HEADER_HEIGHT,
  mapNumberFormat,
  stringifySheets,
  setIfChanged,
  getCellChangesForHistory,
} from '../utils/gridFormatting'
import { GridSkeleton } from './GridSkeleton'
import { SelectedRowsFloater, type SelectedRowRangeState } from './SelectedRowsFloater'

setAutoFreeze(false)

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
  /**
   * Optional broadcaster — when supplied, every cell change committed
   * by the local user is also broadcast over the realtime channel so
   * other connected users see the update. Wired by the sheet page from
   * useRealtimeCollab.broadcastEdit.
   */
  onCellChangeBroadcast?: (
    sheetId: string,
    row: number,
    col: number,
    value: string | number | null,
    display: string,
  ) => void
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

export function SpreadsheetGrid({
  workbookId = null,
  onOpenColumnDNA,
  onSummarizeRows,
  onViewCellHistory,
  onAddComment,
  onCellChangeBroadcast,
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
    hydrationVersion,
  } = useSheetStore(
    // Subscribe to only the fields this component uses (shallow-compared) so it
    // no longer re-renders on every unrelated sheetStore mutation (isSaving,
    // findResults, undoStack, activeFormatting, sortConfig, …).
    useShallow((s) => ({
      gridSheets: s.gridSheets,
      replaceGridSheets: s.replaceGridSheets,
      setGridInstance: s.setGridInstance,
      setGridSheets: s.setGridSheets,
      setSelectedCell: s.setSelectedCell,
      setSelectedRange: s.setSelectedRange,
      setFormulaBarValue: s.setFormulaBarValue,
      updateCell: s.updateCell,
      resetFormatting: s.resetFormatting,
      skipNextTabSync: s.skipNextTabSync,
      setSkipNextTabSync: s.setSkipNextTabSync,
      validationRules: s.validationRules,
      hydrationVersion: s.hydrationVersion,
    })),
  )
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
    () => {
      // hydrationVersion forces a remount whenever the sheet store does a
      // wholesale replaceGridSheets — that's what import, template-load,
      // and bulk operations like dedupe / paste / CF rely on.
      // FortuneSheet only hydrates from the `data` prop on (re)mount, so
      // without this counter, importing into the same sheet IDs left the
      // grid showing the old empty data.
      //
      // NOTE: the per-keystroke flicker the user reported is fixed at the
      // SOURCE — setGridSheets no longer bumps hydrationVersion (see
      // sheetStore), so typing never changes this key and never remounts
      // FortuneSheet. The `data` prop still gets a fresh reference each
      // keystroke, but FortuneSheet is uncontrolled after mount and ignores
      // it, so that's harmless.
      const structural = gridSheets
        .map((sheet) => `${sheet.id}:${sheet.name}:${sheet.order}:${sheet.hide ?? 0}`)
        .join('|')
      return `v${hydrationVersion}|${structural}`
    },
    [gridSheets, hydrationVersion]
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

      const cellChanges = getCellChangesForHistory(gridSheetsRef.current, nextSheets)
      cellChanges.forEach((change) => {
        updateCell(change.address, change.newData, change.oldData, {
          workbookId,
          sheetId: change.sheetId,
          cellAddress: change.cellAddress,
        })
      })

      // Broadcast every local edit to the realtime channel so other
      // connected users see updates in <1s. The broadcaster is provided
      // by the sheet page from useRealtimeCollab.broadcastEdit — when
      // absent (e.g. no Supabase / single-user mode) this is a no-op.
      if (onCellChangeBroadcast && cellChanges.length > 0) {
        for (const change of cellChanges) {
          // CellData (app domain) — coerce the value to the wire format
          // the realtime channel expects (string | number | null + display).
          const v = change.newData?.value
          const rawValue: string | number | null =
            typeof v === 'string' || typeof v === 'number' ? v : v === null ? null : null
          const display = rawValue !== null ? String(rawValue) : ''
          onCellChangeBroadcast(
            change.sheetId,
            change.address.row,
            change.address.col,
            rawValue,
            display,
          )
        }
      }

      // ── Automation trigger firing ────────────────────────────────────
      // Best-effort: fire a trigger event for each changed row so the
      // server-side dispatcher can evaluate automation rules and log runs.
      // We only fire when there's a real workbookId (not demo mode) and
      // at least one cell changed. Failures are swallowed in fireTrigger.
      if (workbookId && cellChanges.length > 0) {
        const { automations } = useAutomationStore.getState()
        if (automations.length > 0) {
          // Group changes by sheetId + rowIndex — one event per row.
          const rowMap = new Map<string, { sheetId: string; rowIndex: number }>()
          for (const change of cellChanges) {
            const key = `${change.sheetId}:${change.address.row}`
            if (!rowMap.has(key)) {
              rowMap.set(key, { sheetId: change.sheetId, rowIndex: change.address.row })
            }
          }
          for (const { sheetId: evtSheetId, rowIndex } of rowMap.values()) {
            const prevSheet = gridSheetsRef.current.find((s) => s.id === evtSheetId)
            const nextSheet = nextSheets.find((s) => s.id === evtSheetId)
            const prevMatrix = prevSheet ? getSheetMatrix(prevSheet) : []
            const nextMatrix = nextSheet ? getSheetMatrix(nextSheet) : []
            const prevRow = (prevMatrix[rowIndex] ?? []).map(
              (c) => getCellFormulaBarValue(c) ?? null,
            )
            const nextRow = (nextMatrix[rowIndex] ?? []).map(
              (c) => getCellFormulaBarValue(c) ?? null,
            )

            // Determine trigger type: a brand-new row (all previous cells
            // empty) → row_created; otherwise always try status_changed
            // first so condition-based automations get evaluated, then
            // fall back to row_updated.
            const wasEmpty = prevRow.every((v) => v === null || v === '')
            const triggerType = wasEmpty ? 'row_created' : 'status_changed'

            const event = buildEvent({
              workbookId,
              sheetId: evtSheetId,
              rowIndex,
              type: triggerType,
              ...(wasEmpty ? {} : { beforeRow: prevRow }),
              afterRow: nextRow,
            })
            fireTrigger(event)

            // If we fired status_changed, also fire row_updated so generic
            // row_updated automations are evaluated too.
            if (!wasEmpty) {
              fireTrigger(buildEvent({
                workbookId,
                sheetId: evtSheetId,
                rowIndex,
                type: 'row_updated',
                beforeRow: prevRow,
                afterRow: nextRow,
              }))
            }
          }
        }
      }

      isApplyingWorkbookChangeRef.current = true
      setGridSheets(nextSheets)
    },
    [setGridSheets, updateCell, workbookId, onCellChangeBroadcast]
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

        // ── Typed-columns check ────────────────────────────────────────
        // Validate the new value against the column's declared type
        // (currency/date/select/checkbox/status). Reject with a toast
        // when the value cannot be coerced; otherwise let the standard
        // commit path proceed. Skip when no type meta is set.
        if (currentSheetId) {
          const colMeta = useColumnTypesStore.getState().getColumnType(currentSheetId, col)
          if (colMeta) {
            const result = validateForEdit(value, colMeta)
            if (!result.ok) {
              toast.error(`${toCellNotation(row, col)}: ${result.error}`)
              return false
            }
          }
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

  // ── UX-2 helpers used by the right-click context menu ──────────────
  // Run a FortuneSheet API op against the cell that was right-clicked.
  // The instance is dynamically typed because @fortune-sheet/react's
  // WorkbookInstance type doesn't expose insertRowOrColumn /
  // deleteRowOrColumn / setCellValue.
  const runGridOp = useCallback(
    (op: (
      inst: {
        insertRowOrColumn: (type: 'row' | 'column', index: number, count: number, dir: 'lefttop' | 'rightbottom') => void
        deleteRowOrColumn: (type: 'row' | 'column', start: number, end: number) => void
        setCellValue: (r: number, c: number, v: unknown) => void
      },
      row: number,
      col: number,
    ) => void) => {
      const inst = workbookRef.current
      const cm = contextMenu
      if (!inst || !cm) return
      try {
        op(inst as unknown as Parameters<typeof op>[0], cm.row, cm.col)
      } catch (e) {
        toast.error(`Failed: ${String(e)}`)
      }
    },
    [contextMenu],
  )

  // Fire the document-level Cut/Copy/Paste so FortuneSheet's existing
  // clipboard pipeline picks up the action. document.execCommand is
  // deprecated but still the only reliable way to drive a third-party
  // canvas grid's clipboard from a menu item without OS permissions.
  const runClipboardCommand = useCallback(async (cmd: 'cut' | 'copy' | 'paste') => {
    try {
      document.execCommand(cmd)
    } catch {
      toast.message(`${cmd[0]?.toUpperCase()}${cmd.slice(1)} via the keyboard (Ctrl+${cmd === 'cut' ? 'X' : cmd === 'copy' ? 'C' : 'V'})`)
    }
  }, [])

  // Paste-values-only: read clipboard text and write each cell as plain
  // string/number, ignoring source formatting + formulas.
  const runPasteValues = useCallback(async () => {
    const inst = workbookRef.current as unknown as {
      setCellValue: (r: number, c: number, v: unknown) => void
    } | null
    const cm = contextMenu
    if (!inst || !cm) return
    try {
      const text = await navigator.clipboard.readText()
      const rows = text.split(/\r?\n/).filter((r, i, arr) => !(i === arr.length - 1 && r === ''))
      rows.forEach((rowText, dr) => {
        rowText.split('\t').forEach((cellText, dc) => {
          const trimmed = cellText.trim()
          const asNum = Number(trimmed)
          const value = trimmed !== '' && !isNaN(asNum) ? asNum : trimmed
          inst.setCellValue(cm.row + dr, cm.col + dc, value)
        })
      })
      toast.success(`Pasted values (${rows.length} row${rows.length > 1 ? 's' : ''})`)
    } catch (e) {
      toast.error(`Paste values failed: ${String(e)}`)
    }
  }, [contextMenu])

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
        <SelectedRowsFloater
          selectedRowRange={selectedRowRange}
          onSummarizeRows={onSummarizeRows}
        />
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
        <CellContextMenu
          ref={contextMenuRef}
          left={contextMenu.left}
          top={contextMenu.top}
          hasRowSelection={!!contextMenu.rowSelection}
          onCut={() => {
            setContextMenu(null)
            void runClipboardCommand('cut')
          }}
          onCopy={() => {
            setContextMenu(null)
            void runClipboardCommand('copy')
          }}
          onPaste={() => {
            setContextMenu(null)
            void runClipboardCommand('paste')
          }}
          onPasteValues={() => {
            setContextMenu(null)
            void runPasteValues()
          }}
          onInsertRowAbove={() => {
            setContextMenu(null)
            runGridOp((inst, row) => inst.insertRowOrColumn('row', row, 1, 'lefttop'))
            toast.success('Row inserted above')
          }}
          onInsertRowBelow={() => {
            setContextMenu(null)
            runGridOp((inst, row) => inst.insertRowOrColumn('row', row, 1, 'rightbottom'))
            toast.success('Row inserted below')
          }}
          onInsertColLeft={() => {
            setContextMenu(null)
            runGridOp((inst, _row, col) => inst.insertRowOrColumn('column', col, 1, 'lefttop'))
            toast.success('Column inserted left')
          }}
          onInsertColRight={() => {
            setContextMenu(null)
            runGridOp((inst, _row, col) => inst.insertRowOrColumn('column', col, 1, 'rightbottom'))
            toast.success('Column inserted right')
          }}
          onDeleteRow={() => {
            setContextMenu(null)
            runGridOp((inst, row) => inst.deleteRowOrColumn('row', row, row))
            toast.success('Row deleted')
          }}
          onDeleteCol={() => {
            setContextMenu(null)
            runGridOp((inst, _row, col) => inst.deleteRowOrColumn('column', col, col))
            toast.success('Column deleted')
          }}
          onClearContents={() => {
            setContextMenu(null)
            runGridOp((inst, row, col) => inst.setCellValue(row, col, null))
          }}
          onFormatCells={() => {
            setContextMenu(null)
            // Surface the Home tab's Number Format dropdown. The Ribbon
            // listens for this event, switches to the Home tab, and opens
            // the Number Format dropdown (see Ribbon.tsx).
            window.dispatchEvent(new CustomEvent('quiksheets:open-format-cells'))
          }}
          onInsertHyperlink={() => {
            setContextMenu(null)
            insertHyperlink()
          }}
          onDefineName={() => {
            setContextMenu(null)
            defineNameFromSelection(workbookId ?? '')
          }}
          onAddComment={onAddComment ? () => {
            const target = contextMenu
            setContextMenu(null)
            if (target && activeSheetId) {
              onAddComment({
                sheetId: activeSheetId,
                cellAddress: toCellNotation(target.row, target.col),
              })
            }
          } : undefined}
          onViewCellHistory={() => {
            setContextMenu(null)
            onViewCellHistory?.()
          }}
          onSummarizeRows={contextMenu.rowSelection && onSummarizeRows ? () => {
            const rowSelection = contextMenu.rowSelection
            setContextMenu(null)
            if (rowSelection) onSummarizeRows(rowSelection)
          } : undefined}
        />
      )}
    </div>
  )
}
