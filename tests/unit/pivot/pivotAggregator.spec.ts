import { describe, it, expect } from 'vitest'
import { pivot, compileCalcExpression } from '@/features/pivot/pivotAggregator'

const matrix: (string | number | null)[][] = [
  ['North', 'Asha',  1000],
  ['North', 'Ben',   2000],
  ['South', 'Chen',  1500],
  ['South', 'Diana',  500],
  ['East',  'Asha',   800],
]

describe('pivot aggregator', () => {
  it('sums revenue grouped by region (no column dimension)', () => {
    const result = pivot(matrix, {
      rows: [0],
      values: [{ column: 2, aggregate: 'sum', label: 'Revenue' }],
    })
    const lookup = Object.fromEntries(
      result.rows.map((r) => [r.keys[0], r.valuesByCol[0]?.[0]])
    )
    expect(lookup.North).toBe(3000)
    expect(lookup.South).toBe(2000)
    expect(lookup.East).toBe(800)
    expect(result.valueLabels).toEqual(['Revenue'])
    expect(result.columnKeys).toEqual([])
  })

  it('counts rows by region', () => {
    const result = pivot(matrix, {
      rows: [0],
      values: [{ column: 2, aggregate: 'count' }],
    })
    const lookup = Object.fromEntries(
      result.rows.map((r) => [r.keys[0], r.valuesByCol[0]?.[0]])
    )
    expect(lookup.North).toBe(2)
    expect(lookup.South).toBe(2)
    expect(lookup.East).toBe(1)
  })

  it('spreads sum across a Columns dimension', () => {
    // group by Region (rows), spread by Salesperson (columns), sum Revenue
    const result = pivot(matrix, {
      rows: [0],
      columns: [1],
      values: [{ column: 2, aggregate: 'sum', label: 'Revenue' }],
    })
    expect(result.columnKeys.length).toBeGreaterThan(0)
    // each result row has one valuesByCol entry per columnKey
    expect(result.rows[0]?.valuesByCol.length).toBe(result.columnKeys.length)
  })

  it('respects filters — only rows whose column value is in `allowed` are aggregated', () => {
    const result = pivot(matrix, {
      rows: [0],
      values: [{ column: 2, aggregate: 'sum' }],
      filters: [{ column: 1, allowed: ['Asha'] }], // only Asha rows
    })
    const lookup = Object.fromEntries(
      result.rows.map((r) => [r.keys[0], r.valuesByCol[0]?.[0]])
    )
    expect(lookup.North).toBe(1000) // Asha N row only
    expect(lookup.East).toBe(800)   // Asha E row
    expect(lookup.South).toBeUndefined() // South had no Asha row
  })

  it('computes calculated fields post-aggregation', () => {
    // matrix with Revenue (col 2) and Cost (col 3)
    const matrixWithCost: (string | number | null)[][] = [
      ['North', 'Asha',  1000, 400],
      ['North', 'Ben',   2000, 600],
      ['South', 'Chen',  1500, 500],
      ['East',  'Asha',   800, 200],
    ]
    const result = pivot(matrixWithCost, {
      rows: [0],
      values: [
        { column: 2, aggregate: 'sum', label: 'Revenue' },
        { column: 3, aggregate: 'sum', label: 'Cost' },
      ],
      calculatedFields: [
        { id: 'cf1', name: 'Profit', expression: 'Revenue - Cost' },
      ],
    })
    const lookup = Object.fromEntries(
      result.rows.map((r) => [r.keys[0], r.valuesByCol[0]])
    )
    // North: Revenue=3000, Cost=1000, Profit=2000
    expect(lookup.North?.[0]).toBe(3000)
    expect(lookup.North?.[1]).toBe(1000)
    expect(lookup.North?.[2]).toBe(2000)
    // South: Revenue=1500, Cost=500, Profit=1000
    expect(lookup.South?.[0]).toBe(1500)
    expect(lookup.South?.[1]).toBe(500)
    expect(lookup.South?.[2]).toBe(1000)
    // East: Revenue=800, Cost=200, Profit=600
    expect(lookup.East?.[0]).toBe(800)
    expect(lookup.East?.[1]).toBe(200)
    expect(lookup.East?.[2]).toBe(600)
    // Calculated field label should appear in valueLabels
    expect(result.valueLabels).toContain('Profit')
  })
})

describe('compileCalcExpression', () => {
  it('evaluates simple arithmetic with field references', () => {
    const fn = compileCalcExpression('Revenue - Cost', ['Revenue', 'Cost'])
    expect(fn({ Revenue: 3000, Cost: 1000 })).toBe(2000)
  })

  it('handles multiplication and division', () => {
    const fn = compileCalcExpression('(Revenue - Cost) / Revenue', ['Revenue', 'Cost'])
    expect(fn({ Revenue: 1000, Cost: 200 })).toBeCloseTo(0.8)
  })

  it('handles numeric literals', () => {
    const fn = compileCalcExpression('Revenue * 0.1', ['Revenue'])
    expect(fn({ Revenue: 500 })).toBe(50)
  })

  it('returns 0 for division by zero', () => {
    const fn = compileCalcExpression('Revenue / Cost', ['Revenue', 'Cost'])
    expect(fn({ Revenue: 500, Cost: 0 })).toBe(0)
  })
})
