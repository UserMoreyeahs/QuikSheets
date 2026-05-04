export type ChartKind =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'stacked_bar'
  | 'doughnut'
  | 'radar'
  | 'waterfall'
  | 'funnel'
  | 'treemap'
  | 'gauge'
  | 'combo'
  | 'heatmap'

/** Human-friendly labels for chart kind selector. */
export const CHART_KIND_LABELS: Record<ChartKind, string> = {
  bar: 'Bar',
  line: 'Line',
  pie: 'Pie',
  scatter: 'Scatter (XY)',
  area: 'Area',
  stacked_bar: 'Stacked Bar',
  doughnut: 'Doughnut',
  radar: 'Radar',
  waterfall: 'Waterfall',
  funnel: 'Funnel',
  treemap: 'Treemap',
  gauge: 'Gauge',
  combo: 'Combo (Bar + Line)',
  heatmap: 'Heatmap',
}

export interface ChartConfig {
  kind: ChartKind
  title?: string
  xAxisLabel?: string
  yAxisLabel?: string
  /** First row of source range is treated as header? */
  hasHeader: boolean
  /** Column index used for category labels (X axis). */
  categoryColumn: number
  /** Column index(es) used as series. */
  seriesColumns: number[]
  legend?: boolean
  /** For combo charts: columns rendered as lines (rest are bars). */
  lineColumns?: number[]
  /** For stacked bar: stack group name. */
  stack?: string
}

export interface ChartDefinition {
  id?: string
  workbookId: string
  sheetId: string
  name: string
  sourceRange: string // A1:E20
  config: ChartConfig
}
