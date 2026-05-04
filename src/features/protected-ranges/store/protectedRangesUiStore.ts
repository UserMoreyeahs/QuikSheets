'use client'

import { create } from 'zustand'

interface ProtectedRangesUiState {
  isOpen: boolean
  open: () => void
  close: () => void
  /** Bumps after add/delete so the dialog re-reads localStorage. */
  version: number
  bump: () => void
}

export const useProtectedRangesUiStore = create<ProtectedRangesUiState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
  version: 0,
  bump:   () => set((s) => ({ version: s.version + 1 })),
}))
