'use client'

/**
 * watchWindowStore — Excel's Formulas > Watch Window.
 *
 * Stores a list of "pinned" cells the user wants to keep an eye on
 * while editing other parts of the workbook. The panel reads live cell
 * values from the sheet store, so updates appear automatically without
 * an explicit subscribe per cell.
 *
 * Identity is (sheetId, row, col). Adding a cell that's already
 * watched is a no-op — keeps the panel from duplicating entries.
 */

import { create } from 'zustand'

export interface WatchedCell {
  /** Stable id we generate so React can key + remove rows reliably. */
  id: string
  sheetId: string
  row: number
  col: number
}

interface WatchWindowState {
  open: boolean
  cells: WatchedCell[]
  openPanel:  () => void
  closePanel: () => void
  togglePanel: () => void
  /** Add a watch entry; ignores duplicates (sheet+row+col). */
  addCell: (sheetId: string, row: number, col: number) => void
  removeCell: (id: string) => void
  clear: () => void
}

export const useWatchWindowStore = create<WatchWindowState>((set) => ({
  open: false,
  cells: [],
  openPanel:   () => set({ open: true }),
  closePanel:  () => set({ open: false }),
  togglePanel: () => set((s) => ({ open: !s.open })),
  addCell: (sheetId, row, col) =>
    set((state) => {
      if (state.cells.some((c) => c.sheetId === sheetId && c.row === row && c.col === col)) {
        return state
      }
      return {
        cells: [...state.cells, { id: crypto.randomUUID(), sheetId, row, col }],
      }
    }),
  removeCell: (id) =>
    set((state) => ({ cells: state.cells.filter((c) => c.id !== id) })),
  clear: () => set({ cells: [] }),
}))
