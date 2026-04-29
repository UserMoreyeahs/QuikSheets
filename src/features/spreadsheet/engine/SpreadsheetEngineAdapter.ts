/**
 * SpreadsheetEngineAdapter — the only allowed boundary between Quiksheets and
 * a concrete spreadsheet engine (FortuneSheet today, Univer next). Every
 * feature module must call methods on this interface, never import directly
 * from @fortune-sheet/* or @univerjs/*.
 *
 * Defined per docs/03_ARCHITECTURE.md §4.1.
 */

export interface CellAddress {
  sheetId: string
  row: number
  col: number
}

export interface CellRange {
  sheetId: string
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export interface CellValue {
  raw: string | number | boolean | null
  formula?: string
  displayValue?: string
}

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontSize?: number
  fontFamily?: string
  textColor?: string
  backgroundColor?: string
  horizontalAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  numberFormat?: string
  wrap?: boolean
}

export interface ValidationRule {
  kind: 'number' | 'text-length' | 'dropdown' | 'date' | 'email' | 'url' | 'custom-formula'
  config: Record<string, unknown>
}

export interface SheetSnapshot {
  id: string
  name: string
  rowCount: number
  columnCount: number
  cells: Array<{ row: number; col: number; value: CellValue; format?: CellFormat }>
}

export interface WorkbookSnapshot {
  sheets: SheetSnapshot[]
  activeSheetId: string
}

export type CellChangeListener = (change: {
  address: CellAddress
  before: CellValue | null
  after: CellValue | null
}) => void

export type SelectionChangeListener = (selection: CellRange | null) => void

export type Unsubscribe = () => void

export interface SpreadsheetEngineAdapter {
  readonly name: 'fortune' | 'univer'

  initialize(container: HTMLElement, workbook: WorkbookSnapshot): Promise<void>
  destroy(): void

  getWorkbook(): WorkbookSnapshot
  setWorkbook(workbook: WorkbookSnapshot): void

  getActiveSheet(): SheetSnapshot
  setActiveSheet(sheetId: string): void

  getSelection(): CellRange | null
  setSelection(range: CellRange | null): void

  getRangeValues(range: CellRange): CellValue[][]
  setRangeValues(range: CellRange, values: CellValue[][]): void

  applyFormatting(range: CellRange, format: CellFormat): void
  applyValidation(range: CellRange, rule: ValidationRule | null): void

  insertRows(sheetId: string, atIndex: number, count: number): void
  deleteRows(sheetId: string, atIndex: number, count: number): void
  insertColumns(sheetId: string, atIndex: number, count: number): void
  deleteColumns(sheetId: string, atIndex: number, count: number): void

  mergeCells(range: CellRange): void
  unmergeCells(range: CellRange): void

  onCellChange(listener: CellChangeListener): Unsubscribe
  onSelectionChange(listener: SelectionChangeListener): Unsubscribe
}

export class NotImplementedError extends Error {
  constructor(method: string, engine: string) {
    super(`${engine} adapter does not yet implement ${method}.`)
    this.name = 'NotImplementedError'
  }
}
