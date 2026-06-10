import type { Cell, CellMatrix, Sheet } from '@fortune-sheet/core'
import { DEFAULT_COLS, DEFAULT_ROWS } from '@/lib/constants'

const STYLE_KEYS = [
  'bl',
  'it',
  'ff',
  'fs',
  'fc',
  'ht',
  'vt',
  'tb',
  'cl',
  'un',
  'tr',
  'bg',
  'ct',
] as const

export function createCell(value: string | number | boolean | null | undefined): Cell | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'string' && value.startsWith('=')) {
    return { f: value.slice(1) }
  }

  return {
    v: value,
    m: typeof value === 'boolean' ? String(value).toUpperCase() : String(value),
  }
}

export function cloneFortuneData<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneFortuneData(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneFortuneData(item)])
    ) as T
  }

  return value
}

/**
 * Remove FortuneSheet's per-sheet SELECTION snapshot before handing sheets
 * to the Workbook (`data` prop or `updateSheet`).
 *
 * FortuneSheet round-trips `luckysheet_select_save` through onChange, so the
 * snapshot in our store is whatever selection existed at the LAST change.
 * On every remount (hydrationVersion bump: fill/sort/dedupe/paste/CF) the
 * Workbook restores that snapshot RAW — without normalizing against live
 * geometry — so the visible selection box (and the fill handle riding its
 * corner) pointed at a STALE cell while the store/name-box had the real one.
 * That desync is why drag-fill "didn't work": the handle wasn't where the
 * selection was. Stripping the snapshot makes the grid fall back to its A1
 * default, and SpreadsheetGrid re-asserts the true selection from the store.
 *
 * Mutates the passed sheets (callers pass a fresh clone) and returns them.
 */
export function stripSelectionState(sheets: Sheet[]): Sheet[] {
  for (const sheet of sheets) {
    const rec = sheet as unknown as Record<string, unknown>
    delete rec['luckysheet_select_save']
    delete rec['luckysheet_selection_range']
  }
  return sheets
}

export function getSheetMatrix(sheet: Sheet): CellMatrix {
  if (sheet.data && sheet.data.length > 0) {
    return sheet.data.map((row) => [...(row ?? [])]) as CellMatrix
  }

  const celldata = sheet.celldata ?? []
  const lastRow = celldata.reduce((max, cell) => Math.max(max, cell.r), -1)
  const lastCol = celldata.reduce((max, cell) => Math.max(max, cell.c), -1)
  const rowCount = Math.max(sheet.row ?? DEFAULT_ROWS, lastRow + 1, 1)
  const colCount = Math.max(sheet.column ?? DEFAULT_COLS, lastCol + 1, 1)

  const matrix: CellMatrix = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => null)
  )

  celldata.forEach((cell) => {
    if (!matrix[cell.r]) {
      matrix[cell.r] = []
    }
    matrix[cell.r]![cell.c] = cell.v ?? null
  })

  return matrix
}

export function cloneSheetWithData(sheet: Sheet, data: CellMatrix): Sheet {
  const maxColumns = data.reduce((max, row) => Math.max(max, row?.length ?? 0), 0)
  const nextSheet = { ...sheet }
  delete nextSheet.celldata

  return {
    ...nextSheet,
    data,
    row: Math.max(sheet.row ?? DEFAULT_ROWS, data.length, 1),
    column: Math.max(sheet.column ?? DEFAULT_COLS, maxColumns, 1),
  }
}

export function getCellFromSheet(sheet: Sheet, row: number, col: number): Cell | null {
  const fromData = sheet.data?.[row]?.[col]
  if (fromData !== undefined) {
    return fromData ?? null
  }

  const fromCelldata = sheet.celldata?.find((cell) => cell.r === row && cell.c === col)
  return fromCelldata?.v ?? null
}

export function getCellDisplayValue(cell: Cell | null | undefined): string | number | boolean | null {
  if (!cell) return null
  if (cell.m !== undefined && cell.m !== null) return cell.m
  if (cell.v !== undefined && cell.v !== null) return cell.v
  if (cell.f) return `=${cell.f}`
  return null
}

/**
 * Value to SORT / COMPARE a cell by. Prefers the raw underlying value `v`
 * (the number 1200 behind a "$1,200.00" currency cell, 0.1234 behind
 * "12.34%", a date serial, or a formula's computed result) so numeric and
 * date columns sort by magnitude — not by their formatted display string.
 * Falls back to the display `m`, then the formula text.
 *
 * Sorting on the display value made "$1,200" sort before "$900" (lexically,
 * because '1' < '9'); sorting on `v` fixes that.
 */
export function getCellSortValue(cell: Cell | null | undefined): string | number | boolean | null {
  if (!cell) return null
  if (cell.v !== undefined && cell.v !== null && cell.v !== '') return cell.v
  if (cell.m !== undefined && cell.m !== null) return cell.m
  if (cell.f) return `=${cell.f}`
  return null
}

export function getCellFormulaBarValue(cell: Cell | null | undefined): string {
  if (!cell) return ''
  if (cell.f) return `=${cell.f}`
  const displayValue = getCellDisplayValue(cell)
  return displayValue !== null && displayValue !== undefined ? String(displayValue) : ''
}

export function clearCellFormatting(cell: Cell | null | undefined): Cell | null {
  if (!cell) return null

  const nextCell: Cell = { ...cell }
  STYLE_KEYS.forEach((key) => {
    delete nextCell[key]
  })

  return nextCell
}

export function isSheetEmpty(sheet: Sheet): boolean {
  const matrix = sheet.data
  if (matrix && matrix.length > 0) {
    return !matrix.some((row) =>
      (row ?? []).some((cell) => {
        const value = getCellDisplayValue(cell)
        return value !== null && value !== ''
      })
    )
  }

  return (sheet.celldata?.length ?? 0) === 0
}

export function createSheetFromImportedData(
  name: string,
  id: string,
  rows: (string | number | boolean | null)[][],
  order: number,
  isActive: boolean
): Sheet {
  const data: CellMatrix = rows.map((row) => row.map((value) => createCell(value)))
  const maxColumns = data.reduce((max, row) => Math.max(max, row.length), 0)

  return {
    id,
    name,
    order,
    status: isActive ? 1 : 0,
    hide: 0,
    row: Math.max(DEFAULT_ROWS, data.length, 1),
    column: Math.max(DEFAULT_COLS, maxColumns, 1),
    data,
  }
}

/** Per-cell metadata captured by the xlsx importer. Mirrors ImportFidelity. */
export interface SheetFidelity {
  formulas: Record<string, string>
  numberFormats: Record<string, string>
  merges: Array<{ r: number; c: number; rs: number; cs: number }>
  colWidths: Record<number, number>
  rowHeights: Record<number, number>
}

/**
 * Convert an imported worksheet (values + fidelity metadata) to a FortuneSheet
 * sheet with formulas, number formats, merges, column widths, and row heights
 * applied. Used by the import flow when the source xlsx had any of those.
 */
export function createSheetFromImportedDataWithFidelity(
  name: string,
  id: string,
  rows: (string | number | boolean | null)[][],
  fidelity: SheetFidelity,
  order: number,
  isActive: boolean,
): Sheet {
  const data: CellMatrix = rows.map((row) => row.map((value) => createCell(value)))
  const maxColumns = data.reduce((max, row) => Math.max(max, row.length), 0)

  // Apply formulas (preserve existing value as the cached result)
  for (const [key, formula] of Object.entries(fidelity.formulas)) {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0', 10)
    const c = parseInt(cStr ?? '0', 10)
    if (!data[r]) continue
    const existing = data[r]![c] ?? null
    const v = existing && typeof existing === 'object' && 'v' in existing ? existing.v : undefined
    data[r]![c] = {
      ...(existing ?? {}),
      f: formula,
      ...(v != null ? { v } : {}),
    } as Cell
  }

  // Apply number formats
  for (const [key, fa] of Object.entries(fidelity.numberFormats)) {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0', 10)
    const c = parseInt(cStr ?? '0', 10)
    if (!data[r]) continue
    const existing = data[r]![c] ?? {}
    data[r]![c] = {
      ...existing,
      ct: { fa, t: 'n' },
    } as Cell
  }

  // FortuneSheet merge format: keyed by 'r_c' string
  const mergeConfig: Record<string, { r: number; c: number; rs: number; cs: number }> = {}
  for (const m of fidelity.merges) {
    mergeConfig[`${m.r}_${m.c}`] = m
  }

  const columnlen: Record<number, number> = {}
  for (const [c, px] of Object.entries(fidelity.colWidths)) columnlen[Number(c)] = px
  const rowlen: Record<number, number> = {}
  for (const [r, px] of Object.entries(fidelity.rowHeights)) rowlen[Number(r)] = px

  return {
    id,
    name,
    order,
    status: isActive ? 1 : 0,
    hide: 0,
    row: Math.max(DEFAULT_ROWS, data.length, 1),
    column: Math.max(DEFAULT_COLS, maxColumns, 1),
    data,
    config: {
      ...(Object.keys(mergeConfig).length > 0 ? { merge: mergeConfig } : {}),
      ...(Object.keys(columnlen).length > 0 ? { columnlen } : {}),
      ...(Object.keys(rowlen).length > 0 ? { rowlen } : {}),
    },
  } as Sheet
}
