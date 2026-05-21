export type CellValue = string | number | boolean | null

export interface CellAddress {
  row: number
  col: number
  sheet: number
}

export interface CellData {
  value: CellValue
  formula?: string
  format?: CellFormat
}

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  fontFamily?: string
  color?: string
  backgroundColor?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  wrap?: boolean
  numberFormat?: string
  borders?: CellBorders
}

export interface CellBorders {
  top?: BorderStyle
  right?: BorderStyle
  bottom?: BorderStyle
  left?: BorderStyle
}

export interface BorderStyle {
  style: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted'
  color: string
}

export interface SheetData {
  id: string
  name: string
  cells: Record<string, CellData>
  rowHeights: Record<number, number>
  colWidths: Record<number, number>
  frozenRows: number
  frozenCols: number
  hiddenRows: number[]
  hiddenCols: number[]
}

export interface Workbook {
  id: string
  name: string
  sheets: SheetData[]
  activeSheetIndex: number
  createdAt: string
  updatedAt: string
  ownerId: string
}

export interface HistoryEntry {
  cellAddress: CellAddress
  before: CellData | null
  after: CellData | null
  timestamp: number
}

export interface FormulaBarState {
  displayValue: string
  isEditing: boolean
  activeCell: CellAddress | null
}

export type FontFamily =
  | 'Inter'
  | 'Arial'
  | 'Georgia'
  | 'Times New Roman'
  | 'Courier New'
  | 'Verdana'
  | 'Trebuchet MS'
  | 'Impact'
  | 'Comic Sans MS'
  | 'Helvetica'
  | 'Palatino'
  | 'Garamond'

export type NumberFormat =
  | 'general'
  | 'number'
  | 'currency'
  | 'accounting'
  | 'percentage'
  | 'fraction'
  | 'scientific'
  | 'text'
  | 'date_short'
  | 'date_long'
  | 'time'

export interface ActiveFormatting {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  fontSize: number
  fontFamily: FontFamily
  textColor: string
  backgroundColor: string
  textAlign: 'left' | 'center' | 'right' | 'justify'
  verticalAlign: 'top' | 'middle' | 'bottom'
  wrapText: boolean
  numberFormat: NumberFormat
}

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  columnIndex: number
  direction: SortDirection
  /**
   * If true, row 0 is treated as a header and held in place; only rows
   * 1+ are sorted. Quick Sort (Sort A→Z / Sort Z→A) defaults to true to
   * match Excel's behaviour of preserving the header row.
   */
  hasHeader?: boolean
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_between'
  | 'date_this_month'
  | 'date_last_n_days'
  | 'top_n'

export interface FilterRule {
  columnIndex: number
  operator: FilterOperator
  value: string
  value2?: string
}

export interface FindReplaceOptions {
  searchValue: string
  replaceValue: string
  matchCase: boolean
  matchEntireCell: boolean
  searchFormulas: boolean
  useRegex: boolean
}

export type ValidationRule =
  | { type: 'any' }
  | { type: 'number'; min?: number; max?: number }
  | { type: 'text'; minLength?: number; maxLength?: number }
  | { type: 'list'; options: string[] }
  | { type: 'date'; min?: string; max?: string }
  | { type: 'email' }
  | { type: 'url' }
  | { type: 'custom'; formula: string }

export interface ValidationConfig {
  rule: ValidationRule
  errorMessage: string
  showDropdown: boolean
}

export interface SheetTab {
  id: string
  name: string
  color: string | null
  isHidden: boolean
  order: number
}

export interface WorkbookState {
  sheets: SheetTab[]
  activeSheetId: string
}

export type SheetContextMenuAction =
  | 'rename'
  | 'delete'
  | 'duplicate'
  | 'hide'
  | 'color'
  | 'move_left'
  | 'move_right'
