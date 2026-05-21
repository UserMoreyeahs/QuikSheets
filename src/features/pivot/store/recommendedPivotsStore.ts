'use client'

import { create } from 'zustand'

interface RecommendedPivotsState {
  open: boolean
  openPicker: () => void
  closePicker: () => void
}

export const useRecommendedPivotsStore = create<RecommendedPivotsState>((set) => ({
  open: false,
  openPicker: () => set({ open: true }),
  closePicker: () => set({ open: false }),
}))
