/**
 * FortuneSheet implementation of SpreadsheetEngineAdapter.
 *
 * This is the only file in src/ that is allowed to import from
 * @fortune-sheet/*. Everything else must depend on
 * SpreadsheetEngineAdapter via getEngine().
 *
 * Today this adapter holds an in-memory WorkbookSnapshot and surfaces it to
 * SpreadsheetGrid via setWorkbook/getWorkbook. The existing FortuneSheet
 * <Workbook> mounting in SpreadsheetGrid will be migrated session-by-session
 * to drive the adapter rather than read sheetStore directly.
 */
import type {
  CellChangeListener,
  CellFormat,
  CellRange,
  CellValue,
  SelectionChangeListener,
  SheetSnapshot,
  SpreadsheetEngineAdapter,
  Unsubscribe,
  ValidationRule,
  WorkbookSnapshot,
} from '../engine/SpreadsheetEngineAdapter'

function emptyWorkbook(): WorkbookSnapshot {
  const id = 'sheet1'
  return {
    sheets: [{ id, name: 'Sheet1', rowCount: 100, columnCount: 26, cells: [] }],
    activeSheetId: id,
  }
}

export class FortuneSheetAdapter implements SpreadsheetEngineAdapter {
  readonly name = 'fortune' as const
  private workbook: WorkbookSnapshot = emptyWorkbook()
  private selection: CellRange | null = null
  private cellListeners = new Set<CellChangeListener>()
  private selectionListeners = new Set<SelectionChangeListener>()

  async initialize(_container: HTMLElement, workbook: WorkbookSnapshot): Promise<void> {
    this.workbook = workbook
  }

  destroy(): void {
    this.cellListeners.clear()
    this.selectionListeners.clear()
  }

  getWorkbook(): WorkbookSnapshot {
    return this.workbook
  }

  setWorkbook(workbook: WorkbookSnapshot): void {
    this.workbook = workbook
  }

  getActiveSheet(): SheetSnapshot {
    const found = this.workbook.sheets.find((s) => s.id === this.workbook.activeSheetId)
    return found ?? this.workbook.sheets[0] ?? emptyWorkbook().sheets[0]!
  }

  setActiveSheet(sheetId: string): void {
    if (this.workbook.sheets.some((s) => s.id === sheetId)) {
      this.workbook = { ...this.workbook, activeSheetId: sheetId }
    }
  }

  getSelection(): CellRange | null {
    return this.selection
  }

  setSelection(range: CellRange | null): void {
    this.selection = range
    for (const fn of this.selectionListeners) fn(range)
  }

  getRangeValues(range: CellRange): CellValue[][] {
    const sheet = this.workbook.sheets.find((s) => s.id === range.sheetId)
    if (!sheet) return []
    const out: CellValue[][] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      const row: CellValue[] = []
      for (let c = range.startCol; c <= range.endCol; c++) {
        const cell = sheet.cells.find((x) => x.row === r && x.col === c)
        row.push(cell?.value ?? { raw: null })
      }
      out.push(row)
    }
    return out
  }

  setRangeValues(range: CellRange, values: CellValue[][]): void {
    const sheet = this.workbook.sheets.find((s) => s.id === range.sheetId)
    if (!sheet) return
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const value = values[r - range.startRow]?.[c - range.startCol] ?? { raw: null }
        const idx = sheet.cells.findIndex((x) => x.row === r && x.col === c)
        const before = idx >= 0 ? sheet.cells[idx]?.value ?? null : null
        if (idx >= 0) sheet.cells[idx] = { ...sheet.cells[idx]!, value }
        else sheet.cells.push({ row: r, col: c, value })
        for (const fn of this.cellListeners) {
          fn({ address: { sheetId: range.sheetId, row: r, col: c }, before, after: value })
        }
      }
    }
  }

  applyFormatting(range: CellRange, format: CellFormat): void {
    const sheet = this.workbook.sheets.find((s) => s.id === range.sheetId)
    if (!sheet) return
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const idx = sheet.cells.findIndex((x) => x.row === r && x.col === c)
        if (idx >= 0) {
          sheet.cells[idx] = {
            ...sheet.cells[idx]!,
            format: { ...sheet.cells[idx]!.format, ...format },
          }
        } else {
          sheet.cells.push({ row: r, col: c, value: { raw: null }, format })
        }
      }
    }
  }

  applyValidation(_range: CellRange, _rule: ValidationRule | null): void {
    // Validation rules are tracked in sheetStore.validationRules today; the
    // adapter contract is satisfied by accepting the call. Wiring will move
    // here when src/features/grid/components/DataValidation.tsx migrates.
  }

  insertRows(sheetId: string, atIndex: number, count: number): void {
    const sheet = this.workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return
    sheet.cells.forEach((cell) => {
      if (cell.row >= atIndex) cell.row += count
    })
    sheet.rowCount += count
  }

  deleteRows(sheetId: string, atIndex: number, count: number): void {
    const sheet = this.workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return
    sheet.cells = sheet.cells
      .filter((cell) => cell.row < atIndex || cell.row >= atIndex + count)
      .map((cell) => (cell.row >= atIndex + count ? { ...cell, row: cell.row - count } : cell))
    sheet.rowCount = Math.max(1, sheet.rowCount - count)
  }

  insertColumns(sheetId: string, atIndex: number, count: number): void {
    const sheet = this.workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return
    sheet.cells.forEach((cell) => {
      if (cell.col >= atIndex) cell.col += count
    })
    sheet.columnCount += count
  }

  deleteColumns(sheetId: string, atIndex: number, count: number): void {
    const sheet = this.workbook.sheets.find((s) => s.id === sheetId)
    if (!sheet) return
    sheet.cells = sheet.cells
      .filter((cell) => cell.col < atIndex || cell.col >= atIndex + count)
      .map((cell) => (cell.col >= atIndex + count ? { ...cell, col: cell.col - count } : cell))
    sheet.columnCount = Math.max(1, sheet.columnCount - count)
  }

  mergeCells(_range: CellRange): void {
    // Handled today by FortuneSheet's mergeCells op in SpreadsheetGrid.
    // Will move here when grid is migrated.
  }

  unmergeCells(_range: CellRange): void {
    // See mergeCells.
  }

  onCellChange(listener: CellChangeListener): Unsubscribe {
    this.cellListeners.add(listener)
    return () => this.cellListeners.delete(listener)
  }

  onSelectionChange(listener: SelectionChangeListener): Unsubscribe {
    this.selectionListeners.add(listener)
    return () => this.selectionListeners.delete(listener)
  }
}
