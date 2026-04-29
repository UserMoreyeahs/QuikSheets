import { describe, it, expect } from 'vitest'
import { toEChartsOption } from '@/features/charts/utils/toEChartsOption'
import type { ChartConfig } from '@/features/charts/types'

const matrix: (string | number | null)[][] = [
  ['Month', 'Revenue', 'Cost'],
  ['Jan', 50000, 30000],
  ['Feb', 70000, 40000],
  ['Mar', 65000, 38000],
]

describe('toEChartsOption', () => {
  it('builds a bar chart with categories from header', () => {
    const config: ChartConfig = {
      kind: 'bar',
      hasHeader: true,
      categoryColumn: 0,
      seriesColumns: [1],
    }
    const opt = toEChartsOption(matrix, config) as { xAxis: { data: string[] }; series: Array<{ type: string; data: number[] }> }
    expect(opt.xAxis.data).toEqual(['Jan', 'Feb', 'Mar'])
    expect(opt.series[0]?.type).toBe('bar')
    expect(opt.series[0]?.data).toEqual([50000, 70000, 65000])
  })

  it('builds a line chart with multiple series', () => {
    const config: ChartConfig = {
      kind: 'line',
      hasHeader: true,
      categoryColumn: 0,
      seriesColumns: [1, 2],
    }
    const opt = toEChartsOption(matrix, config) as { series: Array<{ type: string; data: number[]; name: string }> }
    expect(opt.series).toHaveLength(2)
    expect(opt.series[0]?.name).toBe('Revenue')
    expect(opt.series[1]?.name).toBe('Cost')
    expect(opt.series.every((s) => s.type === 'line')).toBe(true)
  })

  it('builds a pie chart from a single series', () => {
    const config: ChartConfig = {
      kind: 'pie',
      hasHeader: true,
      categoryColumn: 0,
      seriesColumns: [1],
    }
    const opt = toEChartsOption(matrix, config) as { series: Array<{ type: string; data: Array<{ name: string; value: number }> }> }
    expect(opt.series[0]?.type).toBe('pie')
    expect(opt.series[0]?.data).toEqual([
      { name: 'Jan', value: 50000 },
      { name: 'Feb', value: 70000 },
      { name: 'Mar', value: 65000 },
    ])
  })
})
