import { describe, it, expect } from 'vitest'
import { sort, sortby } from '@/lib/formulajsPatches'

const F = { SORT: sort, SORTBY: sortby }

/**
 * Excel-parity pins for SORT/SORTBY. The old impls flattened everything and
 * ignored sort_index/by_col (SORT) and supported only one key (SORTBY).
 */
describe('SORT — sorts a table by a key column (Excel parity)', () => {
  const table = [
    ['Amit', 23000],
    ['Rahul', 12000],
    ['Priya', 5500],
  ]

  it('sorts a 2-D range by sort_index column ascending, keeping rows intact', () => {
    expect(F.SORT(table, 2, 1)).toEqual([
      ['Priya', 5500],
      ['Rahul', 12000],
      ['Amit', 23000],
    ])
  })

  it('sorts descending by a column', () => {
    expect(F.SORT(table, 2, -1)).toEqual([
      ['Amit', 23000],
      ['Rahul', 12000],
      ['Priya', 5500],
    ])
  })

  it('sorts a 1-D list and collapses to flat', () => {
    expect(F.SORT([3, 1, 2])).toEqual([1, 2, 3])
  })

  it('sorts blanks last (Excel behavior)', () => {
    expect(F.SORT([2, null, 1])).toEqual([1, 2, null])
  })

  it('by_col=true sorts columns by a row', () => {
    expect(F.SORT([[3, 1, 2], ['c', 'a', 'b']], 1, 1, true)).toEqual([
      [1, 2, 3],
      ['a', 'b', 'c'],
    ])
  })
})

describe('SORTBY — multi-key (Excel parity)', () => {
  it('single key still works', () => {
    expect(F.SORTBY(['Amit', 'Rahul', 'Priya'], [23000, 12000, 5500], 1)).toEqual([
      'Priya',
      'Rahul',
      'Amit',
    ])
  })

  it('multi-key: primary region asc, secondary amount desc breaks ties', () => {
    const names = ['A', 'B', 'C', 'D']
    const region = ['East', 'West', 'East', 'West']
    const amount = [10, 20, 30, 5]
    // East: C(30),A(10); West: B(20),D(5) → C,A,B,D
    expect(F.SORTBY(names, region, 1, amount, -1)).toEqual(['C', 'A', 'B', 'D'])
  })
})
