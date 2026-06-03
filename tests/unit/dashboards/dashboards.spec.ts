import { describe, it, expect } from 'vitest'
import {
  computeAggregate,
  computeDeltaPercent,
  formatKpiValue,
  makeDefaultLayout,
  type KpiWidget,
  type Widget,
} from '@/features/dashboards/types'

// ---------------------------------------------------------------------------
// computeAggregate
// ---------------------------------------------------------------------------

describe('computeAggregate', () => {
  const nums = [10, 20, 30, 40, 50]

  it('sum returns the total', () => {
    expect(computeAggregate(nums, 'sum')).toBe(150)
  })

  it('avg returns the mean', () => {
    expect(computeAggregate(nums, 'avg')).toBe(30)
  })

  it('count returns the length', () => {
    expect(computeAggregate(nums, 'count')).toBe(5)
  })

  it('min returns the smallest value', () => {
    expect(computeAggregate(nums, 'min')).toBe(10)
  })

  it('max returns the largest value', () => {
    expect(computeAggregate(nums, 'max')).toBe(50)
  })

  it('returns 0 for empty array on all aggregates', () => {
    const aggregates: KpiWidget['aggregate'][] = ['sum', 'avg', 'count', 'min', 'max']
    for (const agg of aggregates) {
      expect(computeAggregate([], agg)).toBe(0)
    }
  })

  it('handles single-element arrays correctly', () => {
    expect(computeAggregate([42], 'sum')).toBe(42)
    expect(computeAggregate([42], 'avg')).toBe(42)
    expect(computeAggregate([42], 'count')).toBe(1)
    expect(computeAggregate([42], 'min')).toBe(42)
    expect(computeAggregate([42], 'max')).toBe(42)
  })

  it('handles negative numbers', () => {
    const negatives = [-5, -3, -1]
    expect(computeAggregate(negatives, 'sum')).toBe(-9)
    expect(computeAggregate(negatives, 'min')).toBe(-5)
    expect(computeAggregate(negatives, 'max')).toBe(-1)
  })

  it('handles decimal values without floating point explosion', () => {
    const decimals = [1.1, 2.2, 3.3]
    expect(computeAggregate(decimals, 'avg')).toBeCloseTo(2.2, 5)
  })
})

// ---------------------------------------------------------------------------
// computeDeltaPercent
// ---------------------------------------------------------------------------

describe('computeDeltaPercent', () => {
  it('returns positive fraction when current > previous', () => {
    // 110 vs 100 = +10%
    const result = computeDeltaPercent(110, 100)
    expect(result).toBeCloseTo(0.1, 10)
  })

  it('returns negative fraction when current < previous', () => {
    // 90 vs 100 = -10%
    const result = computeDeltaPercent(90, 100)
    expect(result).toBeCloseTo(-0.1, 10)
  })

  it('returns 0 when current equals previous', () => {
    expect(computeDeltaPercent(50, 50)).toBe(0)
  })

  it('returns null when previous is 0 (division-by-zero guard)', () => {
    expect(computeDeltaPercent(100, 0)).toBeNull()
    expect(computeDeltaPercent(0, 0)).toBeNull()
  })

  it('uses absolute value of previous so direction is correct for negative baselines', () => {
    // current=-50, previous=-100 → improvement of 50 units, delta = (-50 - -100)/|-100| = 50/100 = 0.5
    const result = computeDeltaPercent(-50, -100)
    expect(result).toBeCloseTo(0.5, 10)
  })
})

// ---------------------------------------------------------------------------
// formatKpiValue
// ---------------------------------------------------------------------------

describe('formatKpiValue', () => {
  it('formats plain numbers with commas', () => {
    const result = formatKpiValue(1234567, 'number')
    expect(result).toContain('1,234,567')
  })

  it('formats currency with $ sign', () => {
    const result = formatKpiValue(9500, 'currency')
    expect(result).toContain('$')
    expect(result).toContain('9,500')
  })

  it('formats percent with % sign', () => {
    const result = formatKpiValue(0.123, 'percent')
    expect(result).toContain('%')
    expect(result).toContain('12.3')
  })

  it('handles 0 gracefully for all formats', () => {
    expect(formatKpiValue(0, 'number')).toBe('0')
    expect(formatKpiValue(0, 'currency')).toContain('$')
    expect(formatKpiValue(0, 'percent')).toContain('%')
  })

  it('handles negative values', () => {
    const result = formatKpiValue(-1234, 'number')
    expect(result).toContain('-')
    expect(result).toContain('1,234')
  })
})

// ---------------------------------------------------------------------------
// makeDefaultLayout
// ---------------------------------------------------------------------------

describe('makeDefaultLayout', () => {
  it('returns layout at y=0 when no existing widgets', () => {
    const layout = makeDefaultLayout([])
    expect(layout.y).toBe(0)
    expect(layout.x).toBe(0)
    expect(layout.w).toBe(4)
    expect(layout.h).toBe(3)
  })

  it('stacks below the lowest widget', () => {
    const widgets: Widget[] = [
      {
        id: '1',
        kind: 'kpi',
        title: 'A',
        range: 'A1',
        aggregate: 'sum',
        format: 'number',
        layout: { x: 0, y: 0, w: 4, h: 2 },
      },
      {
        id: '2',
        kind: 'text',
        content: 'Hello',
        layout: { x: 4, y: 1, w: 4, h: 3 }, // bottom edge at y=4
      },
    ]
    const layout = makeDefaultLayout(widgets)
    // maxY = max(0+2, 1+3) = 4
    expect(layout.y).toBe(4)
  })

  it('accepts custom w and h overrides', () => {
    const layout = makeDefaultLayout([], 6, 5)
    expect(layout.w).toBe(6)
    expect(layout.h).toBe(5)
  })
})
