import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { UNDO_HISTORY_LIMIT } from '@/lib/constants'
import { toCellNotation } from '@/lib/cellAddress'
import { createDefaultWorkbook } from '@/lib/defaultSheet'
import { sortRows } from '@/features/grid/utils/sortUtils'
import { computeHiddenRows } from '@/features/grid/utils/filterUtils'
import {
  evaluateAdvancedFilter,
  type AdvancedFilterCriteria,
} from '@/features/data/utils/advancedFilter'
import { useAdvancedFilterStore } from '@/features/data/store/advancedFilterStore'
import { recordCellChange } from '@/features/cell-history/services/historyService'
import {
  clearCellFormatting,
  cloneFortuneData,
  cloneSheetWithData,
  getCellDisplayValue,
  getSheetMatrix,
} from '@/lib/fortuneSheet'
import type { Cell, Sheet } from '@fortune-sheet/core'
import type { WorkbookInstance } from '@fortune-sheet/react'
import type {
  Workbook,
  CellAddress,
  CellData,
  HistoryEntry,
  ActiveFormatting,
  NumberFormat,
  SortConfig,
  FilterRule,
  ValidationConfig,
} from '@/types/sheet.types'

interface FCellStyle {
  bl?: 0 | 1
  it?: 0 | 1
  un?: 0 | 1
  cl?: 0 | 1
  fs?: number
  ff?: string
  fc?: string
  bg?: string
  ht?: 0 | 1 | 2
  vt?: 0 | 1 | 2
  tb?: '0' | '2'
  ct?: { fa: string; t: 'n' | 's' } | null
}

export interface FoundCell {
  row: number
  col: number
  value: string
}

function numberFormatString(fmt: NumberFormat): string {
  switch (fmt) {
    case 'number':
      return '0.00'
    case 'currency':
      return '$0.00'
    case 'accounting':
      return '$#,##0.00'
    case 'percentage':
      return '0.00%'
    case 'fraction':
      return '# ??/??'
    case 'scientific':
      return '0.00E+00'
    case 'text':
      return '@'
    case 'date_short':
      return 'MM/DD/YYYY'
    case 'date_long':
      return 'MMMM D, YYYY'
    case 'time':
      return 'HH:mm:ss'
    default:
      return 'General'
  }
}

function numberFormatCellType(fmt: NumberFormat): 'n' | 's' {
  return fmt === 'text' ? 's' : 'n'
}

function toFCellStyle(formatting: Partial<ActiveFormatting>): FCellStyle {
  const style: FCellStyle = {}

  if (formatting.bold !== undefined) style.bl = formatting.bold ? 1 : 0
  if (formatting.italic !== undefined) style.it = formatting.italic ? 1 : 0
  if (formatting.underline !== undefined) style.un = formatting.underline ? 1 : 0
  if (formatting.strikethrough !== undefined) style.cl = formatting.strikethrough ? 1 : 0
  if (formatting.fontSize !== undefined) style.fs = formatting.fontSize
  if (formatting.fontFamily !== undefined) style.ff = formatting.fontFamily
  if (formatting.textColor !== undefined) style.fc = formatting.textColor
  if (formatting.backgroundColor !== undefined) style.bg = formatting.backgroundColor

  if (formatting.textAlign !== undefined) {
    style.ht =
      formatting.textAlign === 'left'
        ? 1
        : formatting.textAlign === 'center'
          ? 0
          : 2
  }

  if (formatting.verticalAlign !== undefined) {
    style.vt =
      formatting.verticalAlign === 'top'
        ? 1
        : formatting.verticalAlign === 'middle'
          ? 0
          : 2
  }

  if (formatting.wrapText !== undefined) {
    style.tb = formatting.wrapText ? '2' : '0'
  }

  if (formatting.numberFormat !== undefined) {
    style.ct =
      formatting.numberFormat === 'general'
        ? null
        : {
            fa: numberFormatString(formatting.numberFormat),
            t: numberFormatCellType(formatting.numberFormat),
          }
  }

  return style
}

const defaultFormatting: ActiveFormatting = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  fontSize: 11,
  fontFamily: 'Inter',
  textColor: '#000000',
  backgroundColor: '#ffffff',
  textAlign: 'left',
  verticalAlign: 'bottom',
  wrapText: false,
  numberFormat: 'general',
}

interface SheetState {
  gridSheets: Sheet[]
  gridInstance: WorkbookInstance | null
  workbook: Workbook | null
  activeSheetIndex: number
  selectedCell: CellAddress | null
  selectedRange: { start: CellAddress; end: CellAddress } | null
  editingCell: CellAddress | null
  formulaBarValue: string
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  isSaving: boolean
  lastSavedAt: Date | null
  activeFormatting: ActiveFormatting
  sortConfig: SortConfig | null
  activeFilters: FilterRule[]
  hiddenRows: number[]
  validationRules: Record<string, ValidationConfig>
  skipNextTabSync: boolean
  showFindReplace: boolean
  findResults: FoundCell[]
  /**
   * Monotonic counter bumped on every wholesale gridSheets replacement
   * (setGridSheets / replaceGridSheets). FortuneSheet only hydrates from
   * the `data` prop on initial mount — to force a remount when cell data
   * changes wholesale (import, template load, undo of a bulk op) we
   * include this counter in SpreadsheetGrid's React key so the grid
   * remounts cleanly. See P0 fix for the Excel-import blank-screen bug.
   */
  hydrationVersion: number
}

interface SheetActions {
  setGridSheets: (sheets: Sheet[]) => void
  replaceGridSheets: (sheets: Sheet[]) => void
  setGridInstance: (instance: WorkbookInstance | null) => void
  setWorkbook: (workbook: Workbook) => void
  setActiveSheet: (index: number) => void
  setSelectedCell: (cell: CellAddress | null) => void
  setSelectedRange: (range: { start: CellAddress; end: CellAddress } | null) => void
  setEditingCell: (cell: CellAddress | null) => void
  setFormulaBarValue: (value: string) => void
  updateCell: (
    address: CellAddress,
    data: CellData,
    previousData?: CellData | null,
    historyOptions?: {
      workbookId?: string | null
      sheetId?: string
      cellAddress?: string
    }
  ) => void
  undo: () => void
  redo: () => void
  setIsSaving: (saving: boolean) => void
  setLastSavedAt: (date: Date) => void
  reset: () => void
  setActiveFormatting: (formatting: Partial<ActiveFormatting>) => void
  applyFormatToSelection: (formatting: Partial<ActiveFormatting>) => void
  clearFormatOnSelection: () => void
  resetFormatting: () => void
  setSortConfig: (config: SortConfig | null) => void
  applySort: (config: SortConfig) => void
  setActiveFilters: (filters: FilterRule[]) => void
  addFilter: (filter: FilterRule) => void
  removeFilter: (columnIndex: number) => void
  clearFilters: () => void
  /**
   * Set or clear the Excel-style Advanced Filter for the active sheet.
   * Pass `null` to clear it. The criteria are persisted per-sheet in
   * useAdvancedFilterStore; this action recomputes `config.rowhidden`
   * by OR-ing the advanced filter with any active basic filters.
   */
  applyAdvancedFilterToActiveSheet: (criteria: AdvancedFilterCriteria | null) => void
  setHiddenRows: (rows: number[]) => void
  setValidationRule: (cellKey: string, config: ValidationConfig | null) => void
  setSkipNextTabSync: (skip: boolean) => void
  setShowFindReplace: (show: boolean) => void
  findInGrid: (
    value: string,
    opts: { matchCase: boolean; matchEntireCell: boolean; useRegex: boolean }
  ) => void
  replaceInGrid: (
    search: string,
    replace: string,
    opts: { matchCase: boolean; matchEntireCell: boolean; useRegex: boolean }
  ) => number
}

const initialState: SheetState = {
  gridSheets: createDefaultWorkbook(),
  gridInstance: null,
  workbook: null,
  activeSheetIndex: 0,
  selectedCell: null,
  selectedRange: null,
  editingCell: null,
  formulaBarValue: '',
  undoStack: [],
  redoStack: [],
  isSaving: false,
  lastSavedAt: null,
  activeFormatting: defaultFormatting,
  sortConfig: null,
  activeFilters: [],
  hiddenRows: [],
  validationRules: {},
  skipNextTabSync: false,
  showFindReplace: false,
  findResults: [],
  hydrationVersion: 0,
}

function getActiveSheetIndex(sheets: Sheet[]): number {
  const index = sheets.findIndex((sheet) => sheet.status === 1)
  return index >= 0 ? index : 0
}

function applyStyleToSheet(
  sheet: Sheet,
  cells: Array<{ row: number; col: number }>,
  style: FCellStyle,
  clearAll = false
): Sheet {
  const data = getSheetMatrix(sheet)
  const nextData = data.map((row) => [...(row ?? [])])

  cells.forEach(({ row, col }) => {
    if (!nextData[row]) {
      nextData[row] = []
    }

    const existingCell = (nextData[row]![col] ?? null) as Cell | null
    if (clearAll) {
      nextData[row]![col] = clearCellFormatting(existingCell)
      return
    }

    const nextCell: Cell = { ...(existingCell ?? {}) }
    Object.entries(style).forEach(([key, value]) => {
      if (value === null) {
        delete (nextCell as Record<string, unknown>)[key]
        return
      }

      ;(nextCell as Record<string, unknown>)[key] = value
    })

    nextData[row]![col] = nextCell
  })

  return cloneSheetWithData(sheet, nextData)
}

function selectionCells(
  selectedCell: CellAddress | null,
  selectedRange: { start: CellAddress; end: CellAddress } | null
): Array<{ row: number; col: number }> {
  if (!selectedCell) return []
  if (!selectedRange) return [{ row: selectedCell.row, col: selectedCell.col }]

  const startRow = Math.min(selectedRange.start.row, selectedRange.end.row)
  const endRow = Math.max(selectedRange.start.row, selectedRange.end.row)
  const startCol = Math.min(selectedRange.start.col, selectedRange.end.col)
  const endCol = Math.max(selectedRange.start.col, selectedRange.end.col)

  const cells: Array<{ row: number; col: number }> = []
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      cells.push({ row, col })
    }
  }
  return cells
}

function cellMatchesSearch(
  rawValue: unknown,
  search: string,
  opts: { matchCase: boolean; matchEntireCell: boolean; useRegex: boolean }
): boolean {
  const cellString = rawValue !== null && rawValue !== undefined ? String(rawValue) : ''
  const needle = opts.matchCase ? search : search.toLowerCase()
  const haystack = opts.matchCase ? cellString : cellString.toLowerCase()

  if (opts.useRegex) {
    try {
      const flags = opts.matchCase ? '' : 'i'
      const regex = new RegExp(search, flags)
      return opts.matchEntireCell
        ? regex.test(cellString) && regex.exec(cellString)?.[0] === cellString
        : regex.test(cellString)
    } catch {
      return false
    }
  }

  if (opts.matchEntireCell) return haystack === needle
  return haystack.includes(needle)
}

function cellDataToHistoryValue(data: CellData | null | undefined): string | null {
  if (!data) return null
  if (data.formula) return data.formula.startsWith('=') ? data.formula : `=${data.formula}`
  if (data.value === null || data.value === undefined || data.value === '') return null
  return String(data.value)
}

/**
 * Compute the union of rows hidden by:
 *  - basic filters (FilterRule[] applied per-column), AND
 *  - the active advanced filter for this sheet (criteria range).
 *
 * Returned indices are 0-based row positions in the sheet matrix.
 */
function computeCombinedHiddenRows(
  sheet: Sheet,
  filters: FilterRule[],
  advancedCriteria: AdvancedFilterCriteria | null
): number[] {
  const data = getSheetMatrix(sheet)

  const rowMap: Record<number, Record<number, string | number | null>> = {}
  data.forEach((row, rowIndex) => {
    rowMap[rowIndex] = {}
    ;(row ?? []).forEach((cell, columnIndex) => {
      const value = getCellDisplayValue(cell)
      rowMap[rowIndex]![columnIndex] =
        typeof value === 'boolean' ? String(value) : (value as string | number | null)
    })
  })

  const basicHidden =
    filters.length > 0 ? computeHiddenRows(rowMap, filters, data.length) : []

  let advancedHidden: number[] = []
  if (advancedCriteria) {
    try {
      // Pass the underlying CellMatrix as-is — evaluateAdvancedFilter
      // reads cell objects through getCellDisplayValue-style coercion.
      // We coerce to string|number|boolean|null|undefined inside the
      // evaluator. Build a plain string/number matrix here so the
      // evaluator doesn't need to know about FortuneSheet Cell shapes.
      const displayMatrix: (string | number | boolean | null)[][] = data.map((row) =>
        (row ?? []).map((cell) => {
          const v = getCellDisplayValue(cell)
          return v === undefined ? null : (v as string | number | boolean | null)
        })
      )
      advancedHidden = evaluateAdvancedFilter(displayMatrix, advancedCriteria).hiddenRows
    } catch {
      // Bad criteria range — leave advanced filter inactive rather than
      // crashing. The dialog validates before saving, so this branch
      // only triggers when external state goes stale.
      advancedHidden = []
    }
  }

  if (basicHidden.length === 0) return advancedHidden
  if (advancedHidden.length === 0) return basicHidden

  // Union — a row is hidden if EITHER filter says so.
  const merged = new Set<number>(basicHidden)
  advancedHidden.forEach((r) => merged.add(r))
  return Array.from(merged).sort((a, b) => a - b)
}

/** Pull the active sheet's advanced criteria (or null) from its dedicated store. */
function getActiveAdvancedCriteria(sheets: Sheet[]): AdvancedFilterCriteria | null {
  const activeIndex = getActiveSheetIndex(sheets)
  const sheetId = sheets[activeIndex]?.id
  if (!sheetId) return null
  return useAdvancedFilterStore.getState().criteriaBySheet[sheetId] ?? null
}

/** Convert our selection state to FortuneSheet Range format */
function toFortuneRange(
  selectedCell: CellAddress | null,
  selectedRange: { start: CellAddress; end: CellAddress } | null
): { row: number[]; column: number[] }[] | null {
  if (!selectedCell) return null
  if (!selectedRange) {
    return [{ row: [selectedCell.row, selectedCell.row], column: [selectedCell.col, selectedCell.col] }]
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  return [{ row: [sr, er], column: [sc, ec] }]
}

/** Push formatting changes to FortuneSheet via its instance API */
function pushFormatToGrid(
  instance: WorkbookInstance,
  formatting: Partial<ActiveFormatting>,
  range: { row: number[]; column: number[] }[]
): void {
  const calls: { name: string; args: unknown[] }[] = []

  if (formatting.bold !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['bl', formatting.bold ? 1 : 0, range] })
  if (formatting.italic !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['it', formatting.italic ? 1 : 0, range] })
  if (formatting.underline !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['un', formatting.underline ? 1 : 0, range] })
  if (formatting.strikethrough !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['cl', formatting.strikethrough ? 1 : 0, range] })
  if (formatting.fontSize !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['fs', formatting.fontSize, range] })
  if (formatting.fontFamily !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['ff', formatting.fontFamily, range] })
  if (formatting.textColor !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['fc', formatting.textColor, range] })
  if (formatting.backgroundColor !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['bg', formatting.backgroundColor, range] })
  if (formatting.textAlign !== undefined) {
    const ht = formatting.textAlign === 'left' ? 1 : formatting.textAlign === 'center' ? 0 : 2
    calls.push({ name: 'setCellFormatByRange', args: ['ht', ht, range] })
  }
  if (formatting.verticalAlign !== undefined) {
    const vt = formatting.verticalAlign === 'top' ? 1 : formatting.verticalAlign === 'middle' ? 0 : 2
    calls.push({ name: 'setCellFormatByRange', args: ['vt', vt, range] })
  }
  if (formatting.wrapText !== undefined)
    calls.push({ name: 'setCellFormatByRange', args: ['tb', formatting.wrapText ? 2 : 0, range] })
  if (formatting.numberFormat !== undefined && formatting.numberFormat !== 'general') {
    // FortuneSheet requires { fa, t } when attr is 'ct' — skip for 'general' (default)
    const ct = { fa: numberFormatString(formatting.numberFormat), t: numberFormatCellType(formatting.numberFormat) }
    calls.push({ name: 'setCellFormatByRange', args: ['ct', ct, range] })
  }

  if (calls.length > 0) {
    try {
      instance.batchCallApis(calls)
    } catch {
      // Fallback: call one by one if batch fails
      calls.forEach((call) => {
        try {
          const fn = instance[call.name as keyof WorkbookInstance] as (...args: unknown[]) => void
          fn.apply(instance, call.args)
        } catch { /* ignore */ }
      })
    }
  }
}

export const useSheetStore = create<SheetState & SheetActions>()(
  devtools(
    (set, get) => {
      return {
        ...initialState,

        setGridSheets: (sheets) => {
          const nextSheets = cloneFortuneData(sheets)
          set((state) => ({
            gridSheets: nextSheets,
            activeSheetIndex: getActiveSheetIndex(nextSheets),
            // Bump so SpreadsheetGrid remounts FortuneSheet — needed because
            // FortuneSheet only hydrates from `data` on initial mount.
            hydrationVersion: state.hydrationVersion + 1,
          }))
        },

        replaceGridSheets: (sheets) => {
          const nextSheets = cloneFortuneData(sheets)
          set((state) => ({
            gridSheets: nextSheets,
            activeSheetIndex: getActiveSheetIndex(nextSheets),
            hydrationVersion: state.hydrationVersion + 1,
          }))
        },

        setGridInstance: (instance) => set({ gridInstance: instance }),

        setWorkbook: (workbook) => set({ workbook }),
        setActiveSheet: (index) => set({ activeSheetIndex: index, selectedCell: null }),
        setSelectedCell: (cell) => set({ selectedCell: cell, editingCell: null }),
        setSelectedRange: (range) => set({ selectedRange: range }),
        setEditingCell: (cell) => set({ editingCell: cell }),
        setFormulaBarValue: (value) => set({ formulaBarValue: value }),

        updateCell: (address, data, previousData = null, historyOptions = {}) => {
          const state = get()
          const workbookId = historyOptions.workbookId ?? state.workbook?.id ?? null
          const sheetId =
            historyOptions.sheetId ??
            state.workbook?.sheets[address.sheet]?.id ??
            (typeof state.gridSheets[address.sheet]?.id === 'string'
              ? (state.gridSheets[address.sheet]!.id as string)
              : '')
          const cellAddress = historyOptions.cellAddress ?? toCellNotation(address.row, address.col)

          if (workbookId && sheetId) {
            void recordCellChange(
              workbookId,
              sheetId,
              cellAddress,
              cellDataToHistoryValue(previousData),
              cellDataToHistoryValue(data)
            )
          }

          set((currentState) => {
            const entry: HistoryEntry = {
              cellAddress: address,
              before: previousData,
              after: data,
              timestamp: Date.now(),
            }
            const newUndoStack = [...currentState.undoStack.slice(-UNDO_HISTORY_LIMIT + 1), entry]
            if (!currentState.workbook) return { undoStack: newUndoStack }

            const key = `${address.row}:${address.col}`
            return {
              undoStack: newUndoStack,
              redoStack: [],
              workbook: {
                ...currentState.workbook,
                sheets: currentState.workbook.sheets.map((sheet, index) =>
                  index === address.sheet
                    ? { ...sheet, cells: { ...sheet.cells, [key]: data } }
                    : sheet
                ),
              },
            }
          })
        },

        undo: () =>
          set((state) => {
            const lastEntry = state.undoStack.at(-1)
            if (!lastEntry || !state.workbook) return state

            const key = `${lastEntry.cellAddress.row}:${lastEntry.cellAddress.col}`
            return {
              undoStack: state.undoStack.slice(0, -1),
              redoStack: [...state.redoStack, lastEntry],
              workbook: {
                ...state.workbook,
                sheets: state.workbook.sheets.map((sheet, index) => {
                  if (index !== lastEntry.cellAddress.sheet) return sheet
                  const cells = { ...sheet.cells }
                  if (lastEntry.before) {
                    cells[key] = lastEntry.before
                  } else {
                    delete cells[key]
                  }
                  return { ...sheet, cells }
                }),
              },
            }
          }),

        redo: () =>
          set((state) => {
            const lastEntry = state.redoStack.at(-1)
            if (!lastEntry || !state.workbook) return state

            const key = `${lastEntry.cellAddress.row}:${lastEntry.cellAddress.col}`
            return {
              redoStack: state.redoStack.slice(0, -1),
              undoStack: [...state.undoStack, lastEntry],
              workbook: {
                ...state.workbook,
                sheets: state.workbook.sheets.map((sheet, index) => {
                  if (index !== lastEntry.cellAddress.sheet) return sheet
                  const cells = { ...sheet.cells }
                  if (lastEntry.after) {
                    cells[key] = lastEntry.after
                  } else {
                    delete cells[key]
                  }
                  return { ...sheet, cells }
                }),
              },
            }
          }),

        setIsSaving: (saving) => set({ isSaving: saving }),
        setLastSavedAt: (date) => set({ lastSavedAt: date }),

        reset: () => {
          const gridInstance = get().gridInstance
          set({ ...initialState, gridInstance })
        },

        setActiveFormatting: (formatting) =>
          set((state) => ({
            activeFormatting: { ...state.activeFormatting, ...formatting },
          })),

        applyFormatToSelection: (formatting) => {
          const state = get()
          const cells = selectionCells(state.selectedCell, state.selectedRange)
          const activeFormatting = { ...state.activeFormatting, ...formatting }

          if (cells.length === 0) {
            set({ activeFormatting })
            return
          }

          const instance = state.gridInstance
          if (instance) {
            // Push to FortuneSheet via its API — single source of truth.
            // FortuneSheet's onChange fires back → handleChange → setGridSheets
            // to keep Zustand in sync. Only update activeFormatting here.
            set({ activeFormatting })
            const range = toFortuneRange(state.selectedCell, state.selectedRange)
            if (range) {
              pushFormatToGrid(instance, formatting, range)
            }
          } else {
            // Fallback when grid instance isn't mounted yet
            const style = toFCellStyle(formatting)
            const activeIndex = getActiveSheetIndex(state.gridSheets)
            const newGridSheets = state.gridSheets.map((sheet, index) =>
              index === activeIndex ? applyStyleToSheet(sheet, cells, style) : sheet
            )
            set({ activeFormatting, gridSheets: newGridSheets })
          }
        },

        clearFormatOnSelection: () => {
          const state = get()
          const cells = selectionCells(state.selectedCell, state.selectedRange)
          if (cells.length === 0) {
            set({ activeFormatting: defaultFormatting })
            return
          }

          const instance = state.gridInstance
          if (instance) {
            // Reset each formatting attribute to its default via the API.
            // Skip numberFormat (ct) since 'general' is the default and
            // FortuneSheet requires { fa, t } for ct values.
            set({ activeFormatting: defaultFormatting })
            const range = toFortuneRange(state.selectedCell, state.selectedRange)
            if (range) {
              const clearCalls: { name: string; args: unknown[] }[] = [
                { name: 'setCellFormatByRange', args: ['bl', 0, range] },
                { name: 'setCellFormatByRange', args: ['it', 0, range] },
                { name: 'setCellFormatByRange', args: ['un', 0, range] },
                { name: 'setCellFormatByRange', args: ['cl', 0, range] },
                { name: 'setCellFormatByRange', args: ['fs', 11, range] },
                { name: 'setCellFormatByRange', args: ['ff', 'Inter', range] },
                { name: 'setCellFormatByRange', args: ['fc', '#000000', range] },
                { name: 'setCellFormatByRange', args: ['bg', '#ffffff', range] },
                { name: 'setCellFormatByRange', args: ['ht', 1, range] },
                { name: 'setCellFormatByRange', args: ['vt', 2, range] },
                { name: 'setCellFormatByRange', args: ['tb', 0, range] },
              ]
              try {
                instance.batchCallApis(clearCalls)
              } catch {
                clearCalls.forEach((call) => {
                  try {
                    const fn = instance[call.name as keyof WorkbookInstance] as (...a: unknown[]) => void
                    fn.apply(instance, call.args)
                  } catch { /* ignore */ }
                })
              }
            }
          } else {
            const activeIndex = getActiveSheetIndex(state.gridSheets)
            const newGridSheets = state.gridSheets.map((sheet, index) =>
              index === activeIndex ? applyStyleToSheet(sheet, cells, {}, true) : sheet
            )
            set({ activeFormatting: defaultFormatting, gridSheets: newGridSheets })
          }
        },

        resetFormatting: () => set({ activeFormatting: defaultFormatting }),

        setSortConfig: (config) => set({ sortConfig: config }),

        applySort: (config) => {
          const state = get()
          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const activeSheet = state.gridSheets[activeIndex]
          if (!activeSheet) return

          const data = getSheetMatrix(activeSheet)
          if (data.length === 0) return

          // When hasHeader is true (Quick Sort default), pin row 0 in
          // place and only sort rows 1+. Otherwise treat every row as
          // data — preserves the existing behaviour for callers that
          // truly want a full sort.
          const headerRowCount = config.hasHeader === false ? 0 : 1
          const fixedRows = data.slice(0, headerRowCount)
          const sortableData = data.slice(headerRowCount)

          const rows = sortableData.map((row, rowIndex) => ({
            rowIndex,
            cells: Object.fromEntries(
              (row ?? []).map((cell, columnIndex) => [columnIndex, getCellDisplayValue(cell)])
            ),
          }))

          const sortedRows = sortRows(rows, config)
          const sortedSortable = sortedRows.map(({ rowIndex }) =>
            (sortableData[rowIndex] ?? []).map((cell) => (cell ? { ...cell } : null))
          )
          const sortedData = [
            ...fixedRows.map((row) => (row ?? []).map((cell) => (cell ? { ...cell } : null))),
            ...sortedSortable,
          ]

          const newGridSheets = state.gridSheets.map((sheet, index) =>
            index === activeIndex ? cloneSheetWithData(sheet, sortedData) : sheet
          )

          set({ gridSheets: newGridSheets, sortConfig: config })
        },

        setActiveFilters: (filters) => {
          const state = get()
          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const activeSheet = state.gridSheets[activeIndex]
          if (!activeSheet) {
            set({ activeFilters: filters, hiddenRows: [] })
            return
          }

          const advancedCriteria = getActiveAdvancedCriteria(state.gridSheets)
          const hiddenRows = computeCombinedHiddenRows(activeSheet, filters, advancedCriteria)
          const rowhidden: Record<number, 0> = {}
          hiddenRows.forEach((row) => {
            rowhidden[row] = 0
          })

          const hasAnyFilter = filters.length > 0 || advancedCriteria !== null
          const newGridSheets = state.gridSheets.map((sheet, index) =>
            index === activeIndex
              ? {
                  ...sheet,
                  config: {
                    ...(sheet.config ?? {}),
                    rowhidden: hasAnyFilter ? rowhidden : {},
                  },
                }
              : sheet
          )

          set({ activeFilters: filters, hiddenRows, gridSheets: newGridSheets })
        },

        addFilter: (filter) => {
          const state = get()
          const updatedFilters = [
            ...state.activeFilters.filter((item) => item.columnIndex !== filter.columnIndex),
            filter,
          ]

          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const activeSheet = state.gridSheets[activeIndex]
          if (!activeSheet) return

          const advancedCriteria = getActiveAdvancedCriteria(state.gridSheets)
          const hiddenRows = computeCombinedHiddenRows(activeSheet, updatedFilters, advancedCriteria)
          const rowhidden: Record<number, 0> = {}
          hiddenRows.forEach((row) => {
            rowhidden[row] = 0
          })

          const newGridSheets = state.gridSheets.map((sheet, index) =>
            index === activeIndex
              ? { ...sheet, config: { ...(sheet.config ?? {}), rowhidden } }
              : sheet
          )

          set({ activeFilters: updatedFilters, hiddenRows, gridSheets: newGridSheets })
        },

        removeFilter: (columnIndex) => {
          const state = get()
          const updatedFilters = state.activeFilters.filter(
            (filter) => filter.columnIndex !== columnIndex
          )

          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const activeSheet = state.gridSheets[activeIndex]
          if (!activeSheet) return

          const advancedCriteria = getActiveAdvancedCriteria(state.gridSheets)
          const hiddenRows = computeCombinedHiddenRows(activeSheet, updatedFilters, advancedCriteria)
          const rowhidden: Record<number, 0> = {}
          hiddenRows.forEach((row) => {
            rowhidden[row] = 0
          })

          const hasAnyFilter = updatedFilters.length > 0 || advancedCriteria !== null
          const newGridSheets = state.gridSheets.map((sheet, index) =>
            index === activeIndex
              ? {
                  ...sheet,
                  config: {
                    ...(sheet.config ?? {}),
                    rowhidden: hasAnyFilter ? rowhidden : {},
                  },
                }
              : sheet
          )

          set({ activeFilters: updatedFilters, hiddenRows, gridSheets: newGridSheets })
        },

        clearFilters: () => {
          const state = get()
          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const activeSheet = state.gridSheets[activeIndex]
          if (!activeSheet) {
            set({ activeFilters: [], hiddenRows: [] })
            return
          }

          // "Clear" in the basic-filter sense — drop FilterRule[] but
          // leave the Advanced Filter intact. Recompute so the advanced
          // filter still hides its rows (if any).
          const advancedCriteria = getActiveAdvancedCriteria(state.gridSheets)
          const hiddenRows = computeCombinedHiddenRows(activeSheet, [], advancedCriteria)
          const rowhidden: Record<number, 0> = {}
          hiddenRows.forEach((row) => {
            rowhidden[row] = 0
          })

          const newGridSheets = state.gridSheets.map((sheet, index) =>
            index === activeIndex
              ? {
                  ...sheet,
                  config: {
                    ...(sheet.config ?? {}),
                    rowhidden: advancedCriteria !== null ? rowhidden : {},
                  },
                }
              : sheet
          )

          set({ activeFilters: [], hiddenRows, gridSheets: newGridSheets })
        },

        applyAdvancedFilterToActiveSheet: (criteria) => {
          const state = get()
          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const activeSheet = state.gridSheets[activeIndex]
          if (!activeSheet || !activeSheet.id) return
          const sheetId = activeSheet.id as string

          // Persist (or clear) the criteria in the advanced-filter store.
          const afStore = useAdvancedFilterStore.getState()
          if (criteria === null) {
            afStore.clearCriteria(sheetId)
          } else {
            afStore.setCriteria(sheetId, criteria)
          }

          const hiddenRows = computeCombinedHiddenRows(activeSheet, state.activeFilters, criteria)
          const rowhidden: Record<number, 0> = {}
          hiddenRows.forEach((row) => {
            rowhidden[row] = 0
          })

          const hasAnyFilter = state.activeFilters.length > 0 || criteria !== null
          const newGridSheets = state.gridSheets.map((sheet, index) =>
            index === activeIndex
              ? {
                  ...sheet,
                  config: {
                    ...(sheet.config ?? {}),
                    rowhidden: hasAnyFilter ? rowhidden : {},
                  },
                }
              : sheet
          )

          set({ hiddenRows, gridSheets: newGridSheets })
        },

        setHiddenRows: (rows) => set({ hiddenRows: rows }),

        setValidationRule: (cellKey, config) =>
          set((state) => {
            const rules = { ...state.validationRules }
            if (config === null) {
              delete rules[cellKey]
            } else {
              rules[cellKey] = config
            }
            return { validationRules: rules }
          }),

        setSkipNextTabSync: (skip) => set({ skipNextTabSync: skip }),

        setShowFindReplace: (show) => set({ showFindReplace: show }),

        findInGrid: (value, opts) => {
          const state = get()
          if (!value.trim()) {
            set({ findResults: [] })
            return
          }

          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const sheet = state.gridSheets[activeIndex]
          if (!sheet) {
            set({ findResults: [] })
            return
          }

          const results: FoundCell[] = []
          getSheetMatrix(sheet).forEach((row, rowIndex) => {
            ;(row ?? []).forEach((cell, columnIndex) => {
              const raw = getCellDisplayValue(cell)
              if (!cellMatchesSearch(raw, value, opts)) return

              results.push({
                row: rowIndex,
                col: columnIndex,
                value: raw !== null && raw !== undefined ? String(raw) : '',
              })
            })
          })

          set({ findResults: results })
        },

        replaceInGrid: (search, replace, opts) => {
          const state = get()
          if (!search.trim()) return 0

          const activeIndex = getActiveSheetIndex(state.gridSheets)
          const sheet = state.gridSheets[activeIndex]
          if (!sheet) return 0

          let count = 0
          const data = getSheetMatrix(sheet)
          const nextData = data.map((row) => [...(row ?? [])])

          nextData.forEach((row, rowIndex) => {
            ;(row ?? []).forEach((cell, columnIndex) => {
              const raw = getCellDisplayValue(cell)
              if (!cellMatchesSearch(raw, search, opts)) return

              const currentValue = raw !== null && raw !== undefined ? String(raw) : ''
              let nextValue: string

              if (opts.useRegex) {
                try {
                  const flags = opts.matchCase ? 'g' : 'gi'
                  nextValue = currentValue.replace(new RegExp(search, flags), replace)
                } catch {
                  return
                }
              } else if (opts.matchEntireCell) {
                nextValue = replace
              } else {
                const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                const flags = opts.matchCase ? 'g' : 'gi'
                nextValue = currentValue.replace(new RegExp(pattern, flags), replace)
              }

              const nextCell: Cell = { ...(cell ?? {}) }
              if (nextValue.startsWith('=')) {
                delete nextCell.v
                delete nextCell.m
                nextCell.f = nextValue.slice(1)
              } else {
                delete nextCell.f
                nextCell.v = nextValue
                nextCell.m = nextValue
              }

              nextData[rowIndex]![columnIndex] = nextCell
              count += 1
            })
          })

          if (count > 0) {
            const newGridSheets = state.gridSheets.map((gridSheet, index) =>
              index === activeIndex ? cloneSheetWithData(gridSheet, nextData) : gridSheet
            )

            set({ gridSheets: newGridSheets, findResults: [] })
          }

          return count
        },
      }
    },
    { name: 'sheet-store' }
  )
)
