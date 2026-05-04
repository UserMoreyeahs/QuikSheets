'use client'

import { create } from 'zustand'

interface ForecastState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useForecastStore = create<ForecastState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
}))
