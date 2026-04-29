/**
 * Univer adapter — stub for the primary engine target. Swappable behind
 * NEXT_PUBLIC_ENGINE=univer once the implementation lands. Every method
 * throws NotImplementedError so production traffic on the flag fails loudly
 * rather than silently.
 */
import {
  NotImplementedError,
  type CellChangeListener,
  type CellFormat,
  type CellRange,
  type CellValue,
  type SelectionChangeListener,
  type SheetSnapshot,
  type SpreadsheetEngineAdapter,
  type Unsubscribe,
  type ValidationRule,
  type WorkbookSnapshot,
} from '../engine/SpreadsheetEngineAdapter'

export class UniverAdapter implements SpreadsheetEngineAdapter {
  readonly name = 'univer' as const

  async initialize(_container: HTMLElement, _workbook: WorkbookSnapshot): Promise<void> {
    throw new NotImplementedError('initialize', 'univer')
  }
  destroy(): void {}
  getWorkbook(): WorkbookSnapshot {
    throw new NotImplementedError('getWorkbook', 'univer')
  }
  setWorkbook(_workbook: WorkbookSnapshot): void {
    throw new NotImplementedError('setWorkbook', 'univer')
  }
  getActiveSheet(): SheetSnapshot {
    throw new NotImplementedError('getActiveSheet', 'univer')
  }
  setActiveSheet(_sheetId: string): void {
    throw new NotImplementedError('setActiveSheet', 'univer')
  }
  getSelection(): CellRange | null {
    throw new NotImplementedError('getSelection', 'univer')
  }
  setSelection(_range: CellRange | null): void {
    throw new NotImplementedError('setSelection', 'univer')
  }
  getRangeValues(_range: CellRange): CellValue[][] {
    throw new NotImplementedError('getRangeValues', 'univer')
  }
  setRangeValues(_range: CellRange, _values: CellValue[][]): void {
    throw new NotImplementedError('setRangeValues', 'univer')
  }
  applyFormatting(_range: CellRange, _format: CellFormat): void {
    throw new NotImplementedError('applyFormatting', 'univer')
  }
  applyValidation(_range: CellRange, _rule: ValidationRule | null): void {
    throw new NotImplementedError('applyValidation', 'univer')
  }
  insertRows(_sheetId: string, _atIndex: number, _count: number): void {
    throw new NotImplementedError('insertRows', 'univer')
  }
  deleteRows(_sheetId: string, _atIndex: number, _count: number): void {
    throw new NotImplementedError('deleteRows', 'univer')
  }
  insertColumns(_sheetId: string, _atIndex: number, _count: number): void {
    throw new NotImplementedError('insertColumns', 'univer')
  }
  deleteColumns(_sheetId: string, _atIndex: number, _count: number): void {
    throw new NotImplementedError('deleteColumns', 'univer')
  }
  mergeCells(_range: CellRange): void {
    throw new NotImplementedError('mergeCells', 'univer')
  }
  unmergeCells(_range: CellRange): void {
    throw new NotImplementedError('unmergeCells', 'univer')
  }
  onCellChange(_listener: CellChangeListener): Unsubscribe {
    throw new NotImplementedError('onCellChange', 'univer')
  }
  onSelectionChange(_listener: SelectionChangeListener): Unsubscribe {
    throw new NotImplementedError('onSelectionChange', 'univer')
  }
}
