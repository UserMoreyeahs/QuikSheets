'use client'

import { create } from 'zustand'

interface CleanDataState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useCleanDataStore = create<CleanDataState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
