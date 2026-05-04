import type { ChartConfig, ChartKind } from '../types'

export type RangeMatrix = (string | number | null)[][]

/**
 * Maps a range matrix + ChartConfig to a minimal ECharts options object.
 * Pure function — no side effects. Supports all 14 chart kinds.
 */
export function toEChartsOption(matrix: RangeMatrix, config: ChartConfig): Record<string, unknown> {
  const dataRows = config.hasHeader ? matrix.slice(1) : matrix
  const headerRow = config.hasHeader ? matrix[0] ?? [] : []

  const categories = dataRows.map((row) => String(row[config.categoryColumn] ?? ''))
  const seriesName = (colIdx: number) =>
    config.hasHeader ? String(headerRow[colIdx] ?? `Series ${colIdx + 1}`) : `Series ${colIdx + 1}`

  const numericValues = (colIdx: number) =>
    dataRows.map((row) => {
      const v = row[colIdx]
      return typeof v === 'number' ? v : Number(v ?? 0)
    })

  const kind: ChartKind = config.kind

  // ── Pie / Doughnut ──────────────────────────────────────────────
  if (kind === 'pie' || kind === 'doughnut') {
    const series = config.seriesColumns.map((colIdx) => {
      const values = numericValues(colIdx)
      return {
        type: 'pie' as const,
        name: seriesName(colIdx),
        radius: kind === 'doughnut' ? ['40%', '65%'] : '60%',
        data: values.map((value, i) => ({ name: categories[i] ?? `#${i + 1}`, value })),
        label: { show: true, formatter: '{b}: {d}%' },
      }
    })
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { trigger: 'item' },
      legend: config.legend !== false ? { bottom: 0 } : undefined,
      series,
    }
  }

  // ── Gauge (single value) ────────────────────────────────────────
  if (kind === 'gauge') {
    const colIdx = config.seriesColumns[0] ?? 0
    const vals = numericValues(colIdx)
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { formatter: '{a} <br/>{b} : {c}' },
      series: [
        {
          type: 'gauge',
          name: seriesName(colIdx),
          data: [{ value: Math.round(avg * 100) / 100, name: 'Avg' }],
          detail: { formatter: '{value}' },
        },
      ],
    }
  }

  // ── Funnel ──────────────────────────────────────────────────────
  if (kind === 'funnel') {
    const colIdx = config.seriesColumns[0] ?? 0
    const values = numericValues(colIdx)
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}' },
      legend: config.legend !== false ? { bottom: 0 } : undefined,
      series: [
        {
          type: 'funnel',
          name: seriesName(colIdx),
          sort: 'descending',
          data: values
            .map((v, i) => ({ name: categories[i] ?? `#${i + 1}`, value: v }))
            .sort((a, b) => b.value - a.value),
        },
      ],
    }
  }

  // ── Treemap ─────────────────────────────────────────────────────
  if (kind === 'treemap') {
    const colIdx = config.seriesColumns[0] ?? 0
    const values = numericValues(colIdx)
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { formatter: '{b}: {c}' },
      series: [
        {
          type: 'treemap',
          name: seriesName(colIdx),
          data: values.map((v, i) => ({ name: categories[i] ?? `#${i + 1}`, value: v })),
        },
      ],
    }
  }

  // ── Radar ───────────────────────────────────────────────────────
  if (kind === 'radar') {
    const indicators = categories.map((c) => ({ name: c }))
    const series = config.seriesColumns.map((colIdx) => ({
      value: numericValues(colIdx),
      name: seriesName(colIdx),
    }))
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: {},
      legend: config.legend !== false ? { bottom: 0, data: series.map((s) => s.name) } : undefined,
      radar: { indicator: indicators },
      series: [{ type: 'radar', data: series }],
    }
  }

  // ── Heatmap ─────────────────────────────────────────────────────
  if (kind === 'heatmap') {
    const colIdx = config.seriesColumns[0] ?? 0
    // Build heatmap data: [x, y, value]
    const yLabels = config.seriesColumns.map((c) => seriesName(c))
    const data: [number, number, number][] = []
    for (let si = 0; si < config.seriesColumns.length; si++) {
      const sc = config.seriesColumns[si]
      if (sc === undefined) continue
      const vals = numericValues(sc)
      for (let xi = 0; xi < categories.length; xi++) {
        data.push([xi, si, vals[xi] ?? 0])
      }
    }
    const allVals = data.map((d) => d[2])
    return {
      title: config.title ? { text: config.title, left: 'center' } : undefined,
      tooltip: { position: 'top' },
      xAxis: { type: 'category', data: categories, splitArea: { show: true } },
      yAxis: { type: 'category', data: yLabels, splitArea: { show: true } },
      visualMap: {
        min: allVals.length > 0 ? Math.min(...allVals) : 0,
        max: allVals.length > 0 ? Math.max(...allVals) : 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '15%',
      },
      series: [{
        name: seriesName(colIdx),
        type: 'heatmap',
        data,
        label: { show: true },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      }],
    }
  }

  // ── Scatter ─────────────────────────────────────────────────────
  if (kind === 'scatter') {
    const xCol = config.categoryColumn
    const xValues = numericValues(xCol)
    const series = config.seriesColumns.map((colIdx) => {
      const yValues = numericValues(colIdx)
      return {
        type: 'scatter',
        name: seriesName(colIdx),
        data: xValues.map((x, i) => [x, yValues[i] ?? 0]),
        symbolSize: 8,
      }
    })
    return {
      title: config.title ? { text: config.title } : undefined,
      tooltip: { trigger: 'item' },
      legend: config.legend !== false ? {} : undefined,
      xAxis: { type: 'value', name: config.xAxisLabel },
      yAxis: { type: 'value', name: config.yAxisLabel },
      series,
    }
  }

  // ── Waterfall ───────────────────────────────────────────────────
  if (kind === 'waterfall') {
    const colIdx = config.seriesColumns[0] ?? 0
    const values = numericValues(colIdx)
    // Build waterfall: transparent base + positive bar stacked
    const baseValues: (number | string)[] = []
    const posValues: number[] = []
    const negValues: number[] = []
    let running = 0
    for (const v of values) {
      if (v >= 0) {
        baseValues.push(running)
        posValues.push(v)
        negValues.push(0)
      } else {
        baseValues.push(running + v)
        posValues.push(0)
        negValues.push(-v)
      }
      running += v
    }
    return {
      title: config.title ? { text: config.title } : undefined,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: categories, name: config.xAxisLabel },
      yAxis: { type: 'value', name: config.yAxisLabel },
      series: [
        {
          name: 'Base',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: baseValues,
        },
        {
          name: 'Increase',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: '#22c55e' },
          data: posValues,
          label: { show: true, position: 'top', formatter: (p: { value: number }) => p.value > 0 ? `+${p.value}` : '' },
        },
        {
          name: 'Decrease',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: '#ef4444' },
          data: negValues,
          label: { show: true, position: 'bottom', formatter: (p: { value: number }) => p.value > 0 ? `-${p.value}` : '' },
        },
      ],
    }
  }

  // ── Combo (bar + line) ──────────────────────────────────────────
  if (kind === 'combo') {
    const lineSet = new Set(config.lineColumns ?? [])
    const series = config.seriesColumns.map((colIdx) => {
      const values = numericValues(colIdx)
      const isLine = lineSet.has(colIdx)
      return {
        type: isLine ? 'line' : 'bar',
        name: seriesName(colIdx),
        data: values,
        ...(isLine ? { smooth: true, yAxisIndex: 1 } : {}),
      }
    })
    return {
      title: config.title ? { text: config.title } : undefined,
      tooltip: { trigger: 'axis' },
      legend: config.legend !== false ? {} : undefined,
      xAxis: { type: 'category', data: categories, name: config.xAxisLabel },
      yAxis: [
        { type: 'value', name: config.yAxisLabel },
        { type: 'value', name: 'Secondary' },
      ],
      series,
    }
  }

  // ── Area / Stacked Bar / Line / Bar (cartesian) ─────────────────
  const series = config.seriesColumns.map((colIdx) => {
    const values = numericValues(colIdx)
    const chartType = kind === 'area' || kind === 'stacked_bar' ? (kind === 'area' ? 'line' : 'bar') : kind
    return {
      type: chartType,
      name: seriesName(colIdx),
      data: values,
      ...(kind === 'line' || kind === 'area' ? { smooth: true } : {}),
      ...(kind === 'area' ? { areaStyle: {} } : {}),
      ...(kind === 'stacked_bar' ? { stack: config.stack ?? 'total' } : {}),
    }
  })

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
