import type { ChartConfig } from '../types'

export type RangeMatrix = (string | number | null)[][]

/**
 * Maps a range matrix + ChartConfig to a minimal ECharts options object.
 * Pure function — no side effects. Used by the renderer and unit-testable.
 */
export function toEChartsOption(matrix: RangeMatrix, config: ChartConfig): Record<string, unknown> {
  const dataRows = config.hasHeader ? matrix.slice(1) : matrix
  const headerRow = config.hasHeader ? matrix[0] ?? [] : []

  const categories = dataRows.map((row) => String(row[config.categoryColumn] ?? ''))

  const series = config.seriesColumns.map((colIdx) => {
    const values = dataRows.map((row) => {
      const v = row[colIdx]
      return typeof v === 'number' ? v : Number(v ?? 0)
    })
    const name = config.hasHeader ? String(headerRow[colIdx] ?? `Series ${colIdx + 1}`) : `Series ${colIdx + 1}`
    if (config.kind === 'pie') {
      return {
        type: 'pie',
        name,
        radius: '60%',
        data: values.map((value, i) => ({ name: categories[i] ?? `#${i + 1}`, value })),
      }
    }
    return { type: config.kind, name, data: values, smooth: config.kind === 'line' }
  })

  if (config.kind === 'pie') {
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { trigger: 'item' },
      legend: config.legend !== false ? { bottom: 0 } : undefined,
      series,
    }
  }

  return {
    title: config.title ? { text: config.title } : undefined,
    tooltip: { trigger: 'axis' },
    legend: config.legend !== false ? {} : undefined,
    xAxis: {
      type: 'category',
      data: categories,
      name: config.xAxisLabel,
    },
    yAxis: {
      type: 'value',
      name: config.yAxisLabel,
    },
    series,
  }
}
