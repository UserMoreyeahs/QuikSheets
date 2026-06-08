import type { ChartConfig, ChartKind } from '../types'

export type RangeMatrix = (string | number | null)[][]

/**
 * Maps a range matrix + ChartConfig to a minimal ECharts options object.
 * Pure function — no side effects. Supports all 14 chart kinds.
 *
 * LAYOUT CONTRACT (fixes "chart values overlapping each other"):
 *   • title  → top-center, its own row.
 *   • legend → a separate row below the title (cartesian) or the bottom
 *     strip (pie/funnel/radar) — never stacked on top of the plot or title.
 *   • cartesian plots use a `grid` with `containLabel: true` so the axis
 *     VALUES (long y numbers, x categories) stay inside the box instead of
 *     spilling over the bars, plus `axisLabel.hideOverlap` so crowded
 *     category labels drop out instead of piling up.
 *   • pie/doughnut use `avoidLabelOverlap` so slice labels don't collide.
 * The result is the Excel-like separation of title / legend / axis / plot the
 * user asked for.
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

  // ── Shared layout blocks ────────────────────────────────────────
  // Computed once and reused so every chart kind separates its title,
  // legend, axis values and plot into their own regions.
  const hasTitle = !!config.title
  const showLegend = config.legend !== false

  const titleBlock = hasTitle
    ? { text: config.title, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 600 } }
    : undefined

  // Legend on its own row just below the title (cartesian charts).
  const legendRow = showLegend ? { top: hasTitle ? 30 : 6, type: 'scroll' } : undefined
  // Legend pinned to the bottom strip (round charts where a top legend
  // would crowd the plot).
  const legendBottom = showLegend ? { bottom: 6, type: 'scroll' } : undefined

  // Plot box for cartesian charts. `containLabel` is the key fix: it grows
  // the box inward to fit the axis labels rather than letting them overlap
  // the series. Top clears the title+legend rows; bottom clears the x-axis
  // name when present.
  const cartesianGrid = {
    left: config.yAxisLabel ? 20 : 12,
    right: 28,
    top: (hasTitle ? 30 : 6) + (showLegend ? 26 : 12),
    bottom: config.xAxisLabel ? 44 : 20,
    containLabel: true,
  }

  // Category x-axis: hide labels that would collide; put the axis name
  // centered below the labels instead of jammed at the axis end.
  const categoryXAxis = (data: string[]) => ({
    type: 'category',
    data,
    axisLabel: { hideOverlap: true },
    ...(config.xAxisLabel ? { name: config.xAxisLabel, nameLocation: 'middle', nameGap: 30 } : {}),
  })
  const valueYAxis = () => ({
    type: 'value',
    ...(config.yAxisLabel
      ? { name: config.yAxisLabel, nameLocation: 'middle', nameGap: 44, nameRotate: 90 }
      : {}),
  })

  // ── Pie / Doughnut ──────────────────────────────────────────────
  if (kind === 'pie' || kind === 'doughnut') {
    const series = config.seriesColumns.map((colIdx) => {
      const values = numericValues(colIdx)
      return {
        type: 'pie' as const,
        name: seriesName(colIdx),
        radius: kind === 'doughnut' ? ['40%', '62%'] : '58%',
        center: ['50%', hasTitle ? '54%' : '50%'],
        avoidLabelOverlap: true,
        data: values.map((value, i) => ({ name: categories[i] ?? `#${i + 1}`, value })),
        label: { show: true, formatter: '{b}: {d}%' },
      }
    })
    return {
      title: titleBlock,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: legendBottom,
      series,
    }
  }

  // ── Gauge (single value) ────────────────────────────────────────
  if (kind === 'gauge') {
    const colIdx = config.seriesColumns[0] ?? 0
    const vals = numericValues(colIdx)
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return {
      title: titleBlock,
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
      title: titleBlock,
      tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}' },
      legend: legendBottom,
      series: [
        {
          type: 'funnel',
          name: seriesName(colIdx),
          top: hasTitle ? 40 : 16,
          bottom: showLegend ? 40 : 16,
          sort: 'descending',
          label: { show: true, position: 'inside' },
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
      title: titleBlock,
      tooltip: { formatter: '{b}: {c}' },
      series: [
        {
          type: 'treemap',
          name: seriesName(colIdx),
          top: hasTitle ? 40 : 12,
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
      title: titleBlock,
      tooltip: {},
      legend: showLegend ? { bottom: 6, type: 'scroll', data: series.map((s) => s.name) } : undefined,
      radar: { indicator: indicators, center: ['50%', hasTitle ? '54%' : '50%'], radius: '62%' },
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
      title: titleBlock,
      tooltip: { position: 'top' },
      grid: { left: 12, right: 16, top: hasTitle ? 44 : 20, bottom: 70, containLabel: true },
      xAxis: { type: 'category', data: categories, splitArea: { show: true }, axisLabel: { hideOverlap: true } },
      yAxis: { type: 'category', data: yLabels, splitArea: { show: true } },
      visualMap: {
        min: allVals.length > 0 ? Math.min(...allVals) : 0,
        max: allVals.length > 0 ? Math.max(...allVals) : 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
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
      title: titleBlock,
      tooltip: { trigger: 'item' },
      legend: legendRow,
      grid: cartesianGrid,
      xAxis: {
        type: 'value',
        ...(config.xAxisLabel ? { name: config.xAxisLabel, nameLocation: 'middle', nameGap: 28 } : {}),
      },
      yAxis: valueYAxis(),
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
      title: titleBlock,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: cartesianGrid,
      xAxis: categoryXAxis(categories),
      yAxis: valueYAxis(),
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
      title: titleBlock,
      tooltip: { trigger: 'axis' },
      legend: legendRow,
      // Extra right margin for the secondary y-axis.
      grid: { ...cartesianGrid, right: 48 },
      xAxis: categoryXAxis(categories),
      yAxis: [
        valueYAxis(),
        { type: 'value', name: 'Secondary', nameLocation: 'middle', nameGap: 44, nameRotate: 90 },
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
    title: titleBlock,
    tooltip: { trigger: 'axis' },
    legend: legendRow,
    grid: cartesianGrid,
    xAxis: categoryXAxis(categories),
    yAxis: valueYAxis(),
    series,
  }
}
