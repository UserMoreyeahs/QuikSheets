import { describe, it, expect } from 'vitest'
import type { Cell } from '@fortune-sheet/core'
import { getCellSortValue } from '@/lib/fortuneSheet'
import { sortRows, type RowData } from '@/features/grid/utils/sortUtils'

/**
 * Pins the sort fix: numeric/currency/percent columns must sort by the raw
 * underlying value, not by the formatted display string.
 */
describe('getCellSortValue', () => {
  it('prefers the raw numeric value over the formatted display', () => {
    expect(getCellSortValue({ v: 1200, m: '$1,200.00' } as Cell)).toBe(1200)
    expect(getCellSortValue({ v: 0.1234, m: '12.34%' } as Cell)).toBe(0.1234)
  })

  it('falls back to display, then formula text, then null', () => {
    expect(getCellSortValue({ m: 'North' } as Cell)).toBe('North')
    expect(getCellSortValue({ f: 'SUM(A1:A2)' } as Cell)).toBe('=SUM(A1:A2)')
    expect(getCellSortValue(null)).toBeNull()
    expect(getCellSortValue({} as Cell)).toBeNull()
  })
})

describe('sorting a currency column sorts by magnitude (not lexically)', () => {
  const key = (v: number, m: string) => getCellSortValue({ v, m } as Cell)

  it('orders $75 < $900 < $1,200 ascending (lexical order would be $1,200 < $75 < $900)', () => {
    const rows: RowData[] = [
      { rowIndex: 0, cells: { 0: key(1200, '$1,200.00') } },
      { rowIndex: 1, cells: { 0: key(900, '$900.00') } },
      { rowIndex: 2, cells: { 0: key(75, '$75.00') } },
    ]
    const asc = sortRows(rows, { columnIndex: 0, direction: 'asc', hasHeader: false })
    expect(asc.map((r) => r.rowIndex)).toEqual([2, 1, 0])
  })
})
