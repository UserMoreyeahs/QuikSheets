import type { MouseEvent, RefObject } from 'react'
import { getCellFromSheet, getCellFormulaBarValue } from '@/lib/fortuneSheet'
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from '@/lib/constants'
import { fromCellNotation } from '@/lib/cellAddress'
import { useSheetStore } from '@/store/sheetStore'
import { GRID_ROW_HEADER_WIDTH, GRID_COLUMN_HEADER_HEIGHT } from './gridFormatting'
import type { Sheet } from '@fortune-sheet/core'

export interface CellAddressResult {
  row: number
  col: number
  sheetIndex: number
  anchor: {
    left: number
    top: number
  }
}

export interface RowHeaderResult {
  row: number
  sheetIndex: number
}

export interface FormulaCellResult {
  row: number
  col: number
  sheetIndex: number
  formula: string
  anchor: {
    left: number
    top: number
  }
}

export interface OverlayRect {
  left: number
  top: number
  width: number
  height: number
}

export function getCellAddressFromPointer(
  event: MouseEvent<HTMLDivElement>,
  containerRef: RefObject<HTMLDivElement | null>,
  gridSheets: Sheet[],
  activeSheetId: string | null,
): CellAddressResult | null {
  const rect = containerRef.current?.getBoundingClientRect()
  if (!rect) return null

  const x = event.clientX - rect.left - GRID_ROW_HEADER_WIDTH
  const y = event.clientY - rect.top - GRID_COLUMN_HEADER_HEIGHT
  if (x < 0 || y < 0) return null

  const col = Math.floor(x / DEFAULT_CELL_WIDTH)
  const row = Math.floor(y / DEFAULT_CELL_HEIGHT)
  const sheetIndex = gridSheets.findIndex((sheet) => sheet.id === activeSheetId)
  const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : 0
  const sheet = gridSheets[resolvedSheetIndex]
  if (!sheet) return null

  return {
    row,
    col,
    sheetIndex: resolvedSheetIndex,
    anchor: {
      left: rect.left + GRID_ROW_HEADER_WIDTH + col * DEFAULT_CELL_WIDTH,
      top: rect.top + GRID_COLUMN_HEADER_HEIGHT + (row + 1) * DEFAULT_CELL_HEIGHT + 8,
    },
  }
}

export function getRowHeaderFromPointer(
  event: MouseEvent<HTMLDivElement>,
  containerRef: RefObject<HTMLDivElement | null>,
  gridSheets: Sheet[],
  activeSheetId: string | null,
): RowHeaderResult | null {
  const rect = containerRef.current?.getBoundingClientRect()
  if (!rect) return null

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top - GRID_COLUMN_HEADER_HEIGHT
  if (x < 0 || x > GRID_ROW_HEADER_WIDTH || y < 0) return null

  const row = Math.floor(y / DEFAULT_CELL_HEIGHT)
  const sheetIndex = gridSheets.findIndex((sheet) => sheet.id === activeSheetId)
  return {
    row,
    sheetIndex: sheetIndex >= 0 ? sheetIndex : 0,
  }
}

export function getFormulaCellFromPointer(
  event: MouseEvent<HTMLDivElement>,
  containerRef: RefObject<HTMLDivElement | null>,
  gridSheets: Sheet[],
  activeSheetId: string | null,
): FormulaCellResult | null {
  const cellAddress = getCellAddressFromPointer(event, containerRef, gridSheets, activeSheetId)
  if (!cellAddress) return null

  const sheet = gridSheets[cellAddress.sheetIndex]
  if (!sheet) return null

  const cell = getCellFromSheet(sheet, cellAddress.row, cellAddress.col)
  const formula = getCellFormulaBarValue(cell)
  if (!formula.startsWith('=')) return null

  return {
    row: cellAddress.row,
    col: cellAddress.col,
    sheetIndex: cellAddress.sheetIndex,
    formula,
    anchor: cellAddress.anchor,
  }
}

export function getDependencyOverlay(reference: string): OverlayRect | null {
  const [start, end] = reference.split(':')
  if (!start) return null

  try {
    const startCell = fromCellNotation(start)
    const endCell = end ? fromCellNotation(end) : startCell
    const startRow = Math.min(startCell.row, endCell.row)
    const endRow = Math.max(startCell.row, endCell.row)
    const startCol = Math.min(startCell.col, endCell.col)
    const endCol = Math.max(startCell.col, endCell.col)

    return {
      left: GRID_ROW_HEADER_WIDTH + startCol * DEFAULT_CELL_WIDTH,
      top: GRID_COLUMN_HEADER_HEIGHT + startRow * DEFAULT_CELL_HEIGHT,
      width: (endCol - startCol + 1) * DEFAULT_CELL_WIDTH,
      height: (endRow - startRow + 1) * DEFAULT_CELL_HEIGHT,
    }
  } catch {
    return null
  }
}

export function getActiveCellPosition(): OverlayRect | null {
  const cell = useSheetStore.getState().editingCell
  if (!cell) return null

  return {
    left: GRID_ROW_HEADER_WIDTH + cell.col * DEFAULT_CELL_WIDTH,
    top: GRID_COLUMN_HEADER_HEIGHT + cell.row * DEFAULT_CELL_HEIGHT,
    width: DEFAULT_CELL_WIDTH,
    height: DEFAULT_CELL_HEIGHT,
  }
}
