/**
 * Lightweight A1-range helpers for the chart feature.
 * (We don't depend on the heavier cellAddress.ts here so this stays pure.)
 */

import type { Sheet } from '@fortune-sheet/core'
import { getSheetMatrix, getCellDisplayValue } from '@/lib/fortuneSheet'
import type { RangeMatrix } from '../utils/toEChartsOption'

export interface RangeBounds {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

function colLettersToIndex(letters: string): number {
  let n = 0
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64) // 'A' = 65 → 1
  }
  return n - 1
}

/** Parse "A1:E20" or "A1" — returns null on bad input. */
export function parseA1Range(text: string): RangeBounds | null {
  const trimmed = text.trim().toUpperCase()
  const m = trimmed.match(/^(\$?)([A-Z]+)(\$?)(\d+)(?::(\$?)([A-Z]+)(\$?)(\d+))?$/)
  if (!m) return null
  const colA = colLettersToIndex(m[2]!)
  const rowA = Number(m[4]) - 1
  if (rowA < 0) return null

  if (!m[6]) {
    return { rowStart: rowA, rowEnd: rowA, colStart: colA, colEnd: colA }
  }
  const colB = colLettersToIndex(m[6])
  const rowB = Number(m[8]) - 1
  return {
    rowStart: Math.min(rowA, rowB),
    rowEnd:   Math.max(rowA, rowB),
    colStart: Math.min(colA, colB),
    colEnd:   Math.max(colA, colB),
  }
}

function colIndexToLetters(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function boundsToA1(b: RangeBounds): string {
  const a = `${colIndexToLetters(b.colStart)}${b.rowStart + 1}`
  const z = `${colIndexToLetters(b.colEnd)}${b.rowEnd + 1}`
  return a === z ? a : `${a}:${z}`
}

/**
 * Excel-style contiguous data block detection.  Starting from the given
 * (row, col), expand outward as long as we find non-empty cells in the
 * adjacent row/column.  Stops at the first fully-blank row or column.
 *
 * Returns null when the seed cell itself is empty.
 */
export function detectContiguousDataBlock(
  sheet: Sheet,
  row: number,
  col: number
): RangeBounds | null {
  const matrix = getSheetMatrix(sheet)
  const isEmpty = (r: number, c: number) => {
    const cell = matrix[r]?.[c] ?? null
    const v = getCellDisplayValue(cell)
    return v === null || v === undefined || v === ''
  }

  // walk to the topmost non-empty in this column from row
  let rowStart = row
  while (rowStart > 0 && !isEmpty(rowStart - 1, col)) rowStart--

  // walk to the leftmost non-empty in this row from col
  let colStart = col
  while (colStart > 0 && !isEmpty(rowStart, colStart - 1)) colStart--

  // if seed area is empty, give up
  if (isEmpty(rowStart, colStart)) return null

  // grow the right edge — a column is "in" the block if any of the first
  // few rows from rowStart have data in that column
  let colEnd = colStart
  while (colEnd < (matrix[rowStart]?.length ?? 0) - 1) {
    let columnHasData = false
    for (let r = rowStart; r <= rowStart + 30; r++) {
      if (!isEmpty(r, colEnd + 1)) { columnHasData = true; break }
    }
    if (!columnHasData) break
    colEnd++
  }

  // grow the bottom edge — a row is "in" the block if any cell between
  // colStart and colEnd is non-empty
  let rowEnd = rowStart
  while (rowEnd < matrix.length - 1) {
    let rowHasData = false
    for (let c = colStart; c <= colEnd; c++) {
      if (!isEmpty(rowEnd + 1, c)) { rowHasData = true; break }
    }
    if (!rowHasData) break
    rowEnd++
  }

  return { rowStart, rowEnd, colStart, colEnd }
}

/** Quick yes/no — does any cell in the range hold a numeric (or numeric-string) value? */
export function rangeHasNumericData(sheet: Sheet, range: string): boolean {
  const bounds = parseA1Range(range)
  if (!bounds) return false
  const matrix = getSheetMatrix(sheet)
  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const v = getCellDisplayValue(matrix[r]?.[c] ?? null)
      if (v === null || v === undefined || v === '') continue
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) return true
    }
  }
  return false
}

/** Slice a matrix from a sheet according to an A1-style range. */
export function getRangeMatrix(sheet: Sheet, range: string): RangeMatrix {
  const bounds = parseA1Range(range)
  if (!bounds) return []
  const matrix = getSheetMatrix(sheet)
  const out: RangeMatrix = []
  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    const row: (string | number | null)[] = []
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const cell = matrix[r]?.[c] ?? null
      const display = getCellDisplayValue(cell)
      if (display === null || display === undefined || display === '') row.push(null)
      else if (typeof display === 'boolean') row.push(display ? 1 : 0)
      else row.push(display)
    }
    out.push(row)
  }
  return out
}
