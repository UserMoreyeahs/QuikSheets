import { describe, it, expect } from 'vitest'
import { pivot } from '@/features/pivot/pivotAggregator'

const matrix: (string | number | null)[][] = [
  ['North', 'Asha', 1000],
  ['North', 'Ben', 2000],
  ['South', 'Chen', 1500],
  ['South', 'Diana', 500],
  ['East', 'Asha', 800],
]

describe('pivot aggregator', () => {
  it('sums revenue grouped by region', () => {
    const result = pivot(matrix, {
      rows: [0],
      values: [{ column: 2, aggregate: 'sum', label: 'Revenue' }],
    })
    const lookup = Object.fromEntries(result.rows.map((r) => [r.key[0], r.values[0]]))
    expect(lookup.North).toBe(3000)
    expect(lookup.South).toBe(2000)
    expect(lookup.East).toBe(800)
    expect(result.columnLabels).toEqual(['Revenue'])
  })

  it('counts rows by region', () => {
    const result = pivot(matrix, {
      rows: [0],
      values: [{ column: 2, aggregate: 'count' }],
    })
    const lookup = Object.fromEntries(result.rows.map((r) => [r.key[0], r.values[0]]))
    expect(lookup.North).toBe(2)
    expect(lookup.South).toBe(2)
    expect(lookup.East).toBe(1)
  })
})
