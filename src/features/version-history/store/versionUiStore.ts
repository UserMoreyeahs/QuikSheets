'use client'

import { create } from 'zustand'

interface VersionUiState {
  isOpen: boolean
  open: () => void
  close: () => void
  /** Bumps after snapshot/restore/delete to force panel to re-read. */
  version: number
  bump: () => void
}

export const useVersionUiStore = create<VersionUiState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
  version: 0,
  bump:   () => set((s) => ({ version: s.version + 1 })),
}))
