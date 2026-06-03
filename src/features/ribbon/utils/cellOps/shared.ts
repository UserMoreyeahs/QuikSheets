/**
 * Shared helpers used by cellOps.ts and its sub-modules.
 *
 * Adding new sub-modules under cellOps/ ? Pull anything they need from
 * here instead of duplicating selection / instance accessors.
 */

import { useSheetStore } from '@/store/sheetStore'
import type { WorkbookInstance } from '@fortune-sheet/react'

/** Convert a 0-based column index to its Excel-style letters (A, B, …, AA). */
export function colIndexToLetter(index: number): string {
  let s = ''
  let n = index + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Read selection rows or fall back to the active cell's row. */
export function selectionRows(): { start: number; end: number } | null {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) return null
  if (!selectedRange) return { start: selectedCell.row, end: selectedCell.row }
  return {
    start: Math.min(selectedRange.start.row, selectedRange.end.row),
    end: Math.max(selectedRange.start.row, selectedRange.end.row),
  }
}

/** Read selection cols or fall back to the active cell's col. */
export function selectionCols(): { start: number; end: number } | null {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) return null
  if (!selectedRange) return { start: selectedCell.col, end: selectedCell.col }
  return {
    start: Math.min(selectedRange.start.col, selectedRange.end.col),
    end: Math.max(selectedRange.start.col, selectedRange.end.col),
  }
}

/** Live FortuneSheet workbook instance, or null when grid has not mounted. */
export function getInstance(): WorkbookInstance | null {
  return useSheetStore.getState().gridInstance
}
