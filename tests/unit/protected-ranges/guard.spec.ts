import { describe, it, expect } from 'vitest'

// Re-implement the cellsIntersectRange predicate locally so we can test it
// without spinning up Supabase. The protected-ranges actions module uses
// the same logic.

function colToIndex(letters: string): number {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.toUpperCase().charCodeAt(i) - 64)
  }
  return result - 1
}

function cellsIntersectRange(
  cells: Array<{ rowIndex: number; columnIndex: number }>,
  rangeRef: string
): boolean {
  const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i)
  if (!match) return false
  const [, c1, r1, c2, r2] = match
  if (!c1 || !r1 || !c2 || !r2) return false
  const startCol = colToIndex(c1)
  const endCol = colToIndex(c2)
  const startRow = parseInt(r1, 10) - 1
  const endRow = parseInt(r2, 10) - 1
  for (const cell of cells) {
    if (
      cell.rowIndex >= Math.min(startRow, endRow) &&
      cell.rowIndex <= Math.max(startRow, endRow) &&
      cell.columnIndex >= Math.min(startCol, endCol) &&
      cell.columnIndex <= Math.max(startCol, endCol)
    ) {
      return true
    }
  }
  return false
}

describe('cellsIntersectRange', () => {
  it('detects overlap inside A1:C5', () => {
    expect(
      cellsIntersectRange([{ rowIndex: 2, columnIndex: 1 }], 'A1:C5')
    ).toBe(true)
  })

  it('returns false when no cell overlaps', () => {
    expect(
      cellsIntersectRange([{ rowIndex: 10, columnIndex: 10 }], 'A1:C5')
    ).toBe(false)
  })

  it('handles multi-letter columns AA:AC', () => {
    // Column "AA" -> index 26, "AC" -> 28. Cell at column 27 should match.
    expect(
      cellsIntersectRange([{ rowIndex: 0, columnIndex: 27 }], 'AA1:AC2')
    ).toBe(true)
  })

  it('returns false for malformed range', () => {
    expect(cellsIntersectRange([{ rowIndex: 0, columnIndex: 0 }], 'not-a-range')).toBe(false)
  })
})
