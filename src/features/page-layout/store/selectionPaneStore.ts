'use client'

import { create } from 'zustand'

interface SelectionPaneState {
  open: boolean
  openPane:  () => void
  closePane: () => void
  togglePane: () => void
}

export const useSelectionPaneStore = create<SelectionPaneState>((set) => ({
  open: false,
  openPane:  () => set({ open: true }),
  closePane: () => set({ open: false }),
  togglePane: () => set((state) => ({ open: !state.open })),
}))
