export type ChartKind = 'bar' | 'line' | 'pie'

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
}

export interface ChartDefinition {
  id?: string
  workbookId: string
  sheetId: string
  name: string
  sourceRange: string // A1:E20
  config: ChartConfig
}
