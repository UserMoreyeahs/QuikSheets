'use client'

import { create } from 'zustand'

interface StockImagePickerState {
  open: boolean
  openPicker:  () => void
  closePicker: () => void
}

export const useStockImagePickerStore = create<StockImagePickerState>((set) => ({
  open: false,
  openPicker:  () => set({ open: true }),
  closePicker: () => set({ open: false }),
}))
