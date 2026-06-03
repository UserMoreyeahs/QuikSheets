'use client'

import { create } from 'zustand'

interface FromWebDialogState {
  open: boolean
  openDialog:  () => void
  closeDialog: () => void
}

export const useFromWebDialogStore = create<FromWebDialogState>((set) => ({
  open: false,
  openDialog:  () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}))
