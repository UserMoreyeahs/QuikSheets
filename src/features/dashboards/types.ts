/**
 * Dashboard type definitions for Quiksheets Advanced Dashboards (P2 #32).
 *
 * A Dashboard is a named collection of Widgets arranged on a 12-column
 * virtual canvas. Each Widget has a layout slot { x, y, w, h } where
 * x and w are measured in column-units (12-column grid) and y/h in row-units
 * (each row-unit = 80 px by default).
 */

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Position and size of a widget in the 12-column virtual grid. */
export interface WidgetLayout {
  /** Column offset (0–11). */
  x: number
  /** Row offset (0–N). */
  y: number
  /** Width in columns (1–12). */
  w: number
  /** Height in row-units (1–N). */
  h: number
}

// ---------------------------------------------------------------------------
// Widget kinds
// ---------------------------------------------------------------------------

/**
 * KPI widget — one big metric with optional period-over-period delta.
 *
 * Equivalent to Excel's "Card" visual: bold aggregated value, optional delta
 * arrow with percentage change, and a subtle range/label annotation.
 */
export interface KpiWidget {
  id: string
  kind: 'kpi'
  title: string
  /** A1-notation range the aggregate is computed from (e.g. "B2:B100"). */
  range: string
  aggregate: 'sum' | 'avg' | 'count' | 'min' | 'max'
  format: 'number' | 'currency' | 'percent'
  /** Optional comparison period. Range must be the same shape as `range`. */
  delta?: {
    range: string
    label: string
  }
  layout: WidgetLayout
}

/**
 * Chart widget — wraps the existing ChartRenderer.
 *
 * Reuses ChartConfig semantics (categoryColumn, seriesColumns) to stay
 * consistent with the Insert > Chart flow.
 */
export interface ChartWidget {
  id: string
  kind: 'chart'
  title: string
  /** A1-notation source range (e.g. "A1:E20"). */
  range: string
  hasHeader: boolean
  /** Sheet ID the range belongs to. Empty string = active sheet. */
  sheetId: string
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut'
  /** Index of the category / X-axis column within the range (0-based). */
  categoryColumn: number
  /** Indices of the series / Y-axis columns within the range (0-based). */
  seriesColumns: number[]
  layout: WidgetLayout
}

/**
 * Text widget — free-form label / markdown annotation.
 *
 * Supports a limited subset of markdown: **bold**, *italic*, # Heading, `code`.
 */
export interface TextWidget {
  id: string
  kind: 'text'
  content: string
  layout: WidgetLayout
}

/**
 * Table widget — compact data table from a sheet range.
 */
export interface TableWidget {
  id: string
  kind: 'table'
  title: string
  /** A1-notation range. */
  range: string
  hasHeader: boolean
  /** Cap visible data rows (excluding header). Default 10. */
  maxRows?: number
  layout: WidgetLayout
}

/** Discriminated union of all widget kinds. */
export type Widget = KpiWidget | ChartWidget | TextWidget | TableWidget

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface Dashboard {
  id: string
  workbookId: string
  name: string
  widgets: Widget[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers (pure functions — safe to import server-side and in tests)
// ---------------------------------------------------------------------------

/** Compute a default layout below all existing widgets. */
export function makeDefaultLayout(
  existingWidgets: Widget[],
  w = 4,
  h = 3
): WidgetLayout {
  const maxY = existingWidgets.reduce(
    (acc, wid) => Math.max(acc, wid.layout.y + wid.layout.h),
    0
  )
  return { x: 0, y: maxY, w, h }
}

/**
 * Compute the aggregate value for a KPI widget from a flat numeric array.
 * Exported so it can be unit-tested without DOM.
 */
export function computeAggregate(
  values: number[],
  aggregate: KpiWidget['aggregate']
): number {
  if (values.length === 0) return 0
  switch (aggregate) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'count':
      return values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
}

/**
 * Compute percent-change delta between current and previous aggregates.
 * Returns null when previous is 0 (division-by-zero guard).
 */
export function computeDeltaPercent(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

/**
 * Format a numeric value for display inside a KPI widget.
 */
export function formatKpiValue(
  value: number,
  format: KpiWidget['format']
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value)
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)
    default:
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(value)
  }
}
