'use client'

/**
 * Dialog-open store for the Header & Footer modal. Kept tiny + dedicated
 * so the dialog can be opened from two ribbon entries (Insert > Text >
 * Header & Footer AND Page Layout > Header & Footer) without dragging
 * extra state into the main print settings store.
 */

import { create } from 'zustand'

interface HeaderFooterDialogState {
  open: boolean
  openDialog:  () => void
  closeDialog: () => void
}

export const useHeaderFooterDialogStore = create<HeaderFooterDialogState>((set) => ({
  open: false,
  openDialog:  () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}))
