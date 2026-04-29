export type WidgetKind = 'kpi' | 'chart' | 'table'

export interface KPIConfig {
  label: string
  sourceColumn: number
  aggregate: 'sum' | 'avg' | 'count' | 'min' | 'max'
}

export interface ChartWidgetConfig {
  chartId: string
}

export interface DashboardWidget {
  id: string
  kind: WidgetKind
  x: number
  y: number
  w: number
  h: number
  config: KPIConfig | ChartWidgetConfig
}

export interface DashboardDefinition {
  id?: string
  workbookId: string
  name: string
  layout: { columns: number }
  widgets: DashboardWidget[]
}
