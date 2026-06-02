/**
 * Pure utility: extract a flat array of numeric values from a sheet range.
 *
 * Used by KPI widgets and the delta calculator.
 * No DOM dependency — safe in tests and server components.
 */

import type { Sheet } from '@fortune-sheet/core'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'

/** Parse "A1:E20" or "A1" — returns null on bad input. */
export function parseA1Range(
  text: string
): { rowStart: number; rowEnd: number; colStart: number; colEnd: number } | null {
  const trimmed = text.trim().toUpperCase()
  const m = trimmed.match(
    /^(\$?)([A-Z]+)(\$?)(\d+)(?::(\$?)([A-Z]+)(\$?)(\d+))?$/
  )
  if (!m) return null

  const colLetters = (s: string) => {
    let n = 0
    for (let i = 0; i < s.length; i++) {
      n = n * 26 + (s.charCodeAt(i) - 64)
    }
    return n - 1
  }

  const colA = colLetters(m[2]!)
  const rowA = Number(m[4]) - 1
  if (rowA < 0) return null

  if (!m[6]) {
    return { rowStart: rowA, rowEnd: rowA, colStart: colA, colEnd: colA }
  }
  const colB = colLetters(m[6])
  const rowB = Number(m[8]) - 1
  return {
    rowStart: Math.min(rowA, rowB),
    rowEnd: Math.max(rowA, rowB),
    colStart: Math.min(colA, colB),
    colEnd: Math.max(colA, colB),
  }
}

/**
 * Extract all numeric values from a range on a FortuneSheet sheet.
 * Non-numeric and empty cells are skipped.
 */
export function extractNumericValues(sheet: Sheet, range: string): number[] {
  const bounds = parseA1Range(range)
  if (!bounds) return []

  const matrix = getSheetMatrix(sheet)
  const values: number[] = []

  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const cell = matrix[r]?.[c] ?? null
      const display = getCellDisplayValue(cell)
      if (display === null || display === undefined || display === '') continue
      const n = typeof display === 'number' ? display : Number(display)
      if (Number.isFinite(n)) values.push(n)
    }
  }

  return values
}

/**
 * Extract all cell values (including strings) as a 2-D array from a range.
 * Used by the Table widget to render raw cells.
 */
export function extractRangeMatrix(
  sheet: Sheet,
  range: string
): (string | number | null)[][] {
  const bounds = parseA1Range(range)
  if (!bounds) return []

  const matrix = getSheetMatrix(sheet)
  const out: (string | number | null)[][] = []

  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    const row: (string | number | null)[] = []
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const cell = matrix[r]?.[c] ?? null
      const display = getCellDisplayValue(cell)
      if (display === null || display === undefined || display === '') {
        row.push(null)
      } else if (typeof display === 'boolean') {
        row.push(display ? 1 : 0)
      } else {
        row.push(display)
      }
    }
    out.push(row)
  }

  return out
}
