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
