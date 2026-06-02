'use client'

/**
 * Format-as-Table (Ctrl+T) — applies a banded-row palette to the selection.
 * Extracted from cellOps.ts — Wave 4e.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { colIndexToLetter, getInstance } from './shared'

export const DEFAULT_TABLE_PALETTE = {
  name: 'Light Blue',
  bg: '#DDEBF7',
  header: '#5B9BD5',
  alt: '#FFFFFF',
} as const

interface TablePalette {
  bg: string
  header: string
  alt: string
}

export function applyTablePalette(palette: TablePalette = DEFAULT_TABLE_PALETTE): void {
  const inst = getInstance()
  const { selectedCell, selectedRange, applyFormatToSelection } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a range first')
    return
  }
  const r = selectedRange
  const sr = r ? Math.min(r.start.row, r.end.row) : selectedCell.row
  const er = r ? Math.max(r.start.row, r.end.row) : selectedCell.row
  const sc = r ? Math.min(r.start.col, r.end.col) : selectedCell.col
  const ec = r ? Math.max(r.start.col, r.end.col) : selectedCell.col

  if (sr === er && sc === ec) {
    toast.message('Select a multi-cell range to format as table')
    return
  }

  try {
    const gi = inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }
    // Header row
    gi.setCellFormatByRange('bg', palette.header, [{ row: [sr, sr], column: [sc, ec] }])
    gi.setCellFormatByRange('fc', '#FFFFFF',       [{ row: [sr, sr], column: [sc, ec] }])
    gi.setCellFormatByRange('bl', 1,                [{ row: [sr, sr], column: [sc, ec] }])
    // Body rows: alternate
    for (let row = sr + 1; row <= er; row += 1) {
      const bg = (row - sr) % 2 === 1 ? palette.bg : palette.alt
      gi.setCellFormatByRange('bg', bg, [{ row: [row, row], column: [sc, ec] }])
    }
    toast.success(`Table style applied to ${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`)
  } catch (e) {
    // Fallback for grids without the format API
    applyFormatToSelection({ backgroundColor: palette.bg })
    toast.error(`Partial table format: ${String(e)}`)
  }
}
