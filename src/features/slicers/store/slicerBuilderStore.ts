'use client'

import { create } from 'zustand'

interface SlicerBuilderState {
  open: boolean
  openBuilder: () => void
  closeBuilder: () => void
}

export const useSlicerBuilderStore = create<SlicerBuilderState>((set) => ({
  open: false,
  openBuilder: () => set({ open: true }),
  closeBuilder: () => set({ open: false }),
}))
