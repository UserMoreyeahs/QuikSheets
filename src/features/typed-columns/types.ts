/**
 * Typed Columns — Airtable-style column type system.
 *
 * Each column in a sheet can be tagged with a `ColumnType`. The type
 * controls three things:
 *
 *   1. Display formatting    — how the cell value renders in the grid
 *   2. Input validation       — whether a typed value is accepted
 *   3. Edit affordance        — checkbox toggle, select dropdown, etc.
 *
 * Storage: per-workbook localStorage key
 *   `quiksheets_column_types:<workbookId>`
 *   value shape: `{ [sheetId]: { [colIndex]: ColumnTypeMeta } }`
 *
 * This is intentionally NOT the same as per-cell `DataValidation` —
 * typed columns apply to the entire column declaratively, while
 * DataValidation handles arbitrary rules per cell range.
 */

/** The seven supported column types. */
export type ColumnType =
  | 'text'      // Default — any string
  | 'number'    // Numeric only; rendered right-aligned with thousands separators
  | 'currency'  // Numeric; prefixed with ₹ (default) and 2 decimal places
  | 'date'      // ISO or locale date; rendered as dd-MMM-yyyy
  | 'select'    // Constrained to `options[]`; renders as a chip
  | 'checkbox'  // Boolean — true/false / 0/1 / yes/no — rendered as ☐ / ☑
  | 'status'    // Constrained select with colored chips (Active/Pending/Done…)

/** Metadata stored per (sheet, column). */
export interface ColumnTypeMeta {
  type: ColumnType
  /** Required when `type === 'select'` or `'status'`. */
  options?: string[]
  /**
   * Currency symbol (defaults to '₹' for India SMB ICP).
   * Used only when `type === 'currency'`.
   */
  currencySymbol?: string
  /**
   * Decimal places for currency / number (default 2 / 0 respectively).
   */
  decimals?: number
  /**
   * Date display pattern: 'iso' | 'short' | 'long' (default 'short').
   */
  dateFormat?: 'iso' | 'short' | 'long'
}

/** Default presets for the `status` column type (Excel-like color pills). */
export interface StatusPreset {
  label: string
  /** Hex background fill for the chip. */
  fill: string
  /** Hex text colour for the chip. */
  color: string
}

export const STATUS_PRESETS: StatusPreset[] = [
  { label: 'Active',     fill: '#DCFCE7', color: '#166534' },
  { label: 'Pending',    fill: '#FEF3C7', color: '#92400E' },
  { label: 'On Hold',    fill: '#E5E7EB', color: '#374151' },
  { label: 'Done',       fill: '#DBEAFE', color: '#1E40AF' },
  { label: 'Cancelled',  fill: '#FECACA', color: '#991B1B' },
  { label: 'Overdue',    fill: '#FECACA', color: '#991B1B' },
]

/** Display labels for the column type picker UI. */
export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  number: 'Number',
  currency: 'Currency',
  date: 'Date',
  select: 'Select (single choice)',
  checkbox: 'Checkbox',
  status: 'Status',
}

/** Lightweight icon hint per type — consumed by the picker UI. */
export const COLUMN_TYPE_ICONS: Record<ColumnType, string> = {
  text: 'Aa',
  number: '123',
  currency: '$',
  date: '📅',
  select: '☰',
  checkbox: '☑',
  status: '●',
}
