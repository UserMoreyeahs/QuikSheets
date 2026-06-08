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

/**
 * Pins the layout fix for "chart values overlapping each other / want a
 * separate section for values". Title, legend, axis values and plot must each
 * occupy their own region.
 */
describe('toEChartsOption layout (no-overlap contract)', () => {
  const base = { hasHeader: true as const, categoryColumn: 0, seriesColumns: [1] }

  it('cartesian charts use a containLabel grid so axis values stay inside the plot', () => {
    const opt = toEChartsOption(matrix, { ...base, kind: 'bar' }) as { grid: { containLabel: boolean } }
    expect(opt.grid.containLabel).toBe(true)
  })

  it('puts the legend on its own row below the title, and the plot below both', () => {
    const opt = toEChartsOption(matrix, { ...base, kind: 'bar', title: 'Sales', legend: true }) as {
      title: { top: number; left: string }
      legend: { top: number }
      grid: { top: number }
    }
    expect(opt.title.left).toBe('center')
    expect(opt.legend.top).toBeGreaterThan(opt.title.top) // legend below title
    expect(opt.grid.top).toBeGreaterThan(opt.legend.top) // plot below legend
  })

  it('hides overlapping category labels on the x-axis', () => {
    const opt = toEChartsOption(matrix, { ...base, kind: 'bar' }) as {
      xAxis: { axisLabel: { hideOverlap: boolean } }
    }
    expect(opt.xAxis.axisLabel.hideOverlap).toBe(true)
  })

  it('pie slices avoid label overlap and the legend drops to the bottom strip', () => {
    const opt = toEChartsOption(matrix, { ...base, kind: 'pie', legend: true }) as {
      series: Array<{ avoidLabelOverlap: boolean }>
      legend: { bottom: number }
    }
    expect(opt.series[0]?.avoidLabelOverlap).toBe(true)
    expect(opt.legend.bottom).toBeDefined()
  })

  it('omits the legend entirely when disabled', () => {
    const opt = toEChartsOption(matrix, { ...base, kind: 'bar', legend: false }) as { legend?: unknown }
    expect(opt.legend).toBeUndefined()
  })
})
