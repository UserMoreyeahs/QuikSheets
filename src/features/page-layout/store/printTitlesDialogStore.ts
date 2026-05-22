'use client'

import { create } from 'zustand'

interface PrintTitlesDialogState {
  open: boolean
  openDialog:  () => void
  closeDialog: () => void
}

export const usePrintTitlesDialogStore = create<PrintTitlesDialogState>((set) => ({
  open: false,
  openDialog:  () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}))
