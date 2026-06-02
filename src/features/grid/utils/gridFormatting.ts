import { getCellFormulaBarValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { toCellNotation } from '@/lib/cellAddress'
import type { Cell, Sheet } from '@fortune-sheet/core'
import type { CellData, FontFamily, NumberFormat } from '@/types/sheet.types'

export const DEFAULT_FORMATTING = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  fontSize: 11,
  fontFamily: 'Inter' as FontFamily,
  textColor: '#000000',
  backgroundColor: '#ffffff',
  textAlign: 'left' as const,
  verticalAlign: 'bottom' as const,
  wrapText: false,
  numberFormat: 'general' as NumberFormat,
}

export const GRID_ROW_HEADER_WIDTH = 46
export const GRID_COLUMN_HEADER_HEIGHT = 20

export function mapNumberFormat(format?: string): NumberFormat {
  const normalized = format?.toLowerCase() ?? ''
  if (!normalized || normalized === 'general') return 'general'
  if (normalized === '@') return 'text'
  if (normalized.includes('%')) return 'percentage'
  if (normalized.includes('e+')) return 'scientific'
  if (normalized.includes('?/?')) return 'fraction'
  if (normalized.includes('mmmm')) return 'date_long'
  if (normalized.includes('mm/dd') || normalized.includes('yyyy')) return 'date_short'
  if (normalized.includes('hh') || normalized.includes('ss')) return 'time'
  if (normalized.includes('$')) return normalized.includes('#,##') ? 'accounting' : 'currency'
  if (normalized.includes('0.00') || normalized.includes('#,##')) return 'number'
  return 'general'
}

export function stringifySheets(sheets: Sheet[]): string {
  return JSON.stringify(sheets)
}

export function setIfChanged<T>(current: T, next: T, setter: (value: T) => void) {
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    setter(next)
  }
}

function normalizeCellHistoryValue(cell: Cell | null | undefined): string | null {
  const value = getCellFormulaBarValue(cell)
  return value === '' ? null : value
}

function historyValueToCellData(value: string | null): CellData {
  if (value && value.startsWith('=')) {
    return { value: null, formula: value }
  }

  return { value }
}

export interface CellChangeForHistory {
  address: { row: number; col: number; sheet: number }
  cellAddress: string
  newData: CellData
  oldData: CellData
  sheetId: string
}

export function getCellChangesForHistory(previousSheets: Sheet[], nextSheets: Sheet[]): CellChangeForHistory[] {
  const changes: CellChangeForHistory[] = []
  const sheetCount = Math.min(previousSheets.length, nextSheets.length)

  for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
    const previousSheet = previousSheets[sheetIndex]
    const nextSheet = nextSheets[sheetIndex]
    if (!previousSheet || !nextSheet) continue

    const sheetId = typeof nextSheet.id === 'string' ? nextSheet.id : `sheet-${sheetIndex}`
    const previousMatrix = getSheetMatrix(previousSheet)
    const nextMatrix = getSheetMatrix(nextSheet)
    const rowCount = Math.max(previousMatrix.length, nextMatrix.length)

    for (let row = 0; row < rowCount; row += 1) {
      const previousRow = previousMatrix[row] ?? []
      const nextRow = nextMatrix[row] ?? []
      const colCount = Math.max(previousRow.length, nextRow.length)

      for (let col = 0; col < colCount; col += 1) {
        const oldValue = normalizeCellHistoryValue(previousRow[col] ?? null)
        const newValue = normalizeCellHistoryValue(nextRow[col] ?? null)
        if (oldValue === newValue) continue

        changes.push({
          address: { row, col, sheet: sheetIndex },
          cellAddress: toCellNotation(row, col),
          oldData: historyValueToCellData(oldValue),
          newData: historyValueToCellData(newValue),
          sheetId,
        })
      }
    }
  }

  return changes
}
