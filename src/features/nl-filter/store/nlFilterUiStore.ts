'use client'

import { create } from 'zustand'

interface NLFilterUiState {
  visible: boolean
  toggle: () => void
  setVisible: (v: boolean) => void
}

/**
 * Controls visibility of the natural-language filter bar above the grid.
 * Defaults to hidden so the grid gets the extra ~36px of vertical real
 * estate — users open it on demand from the formula bar's filter button
 * or via Ctrl+Shift+L.
 */
export const useNLFilterUiStore = create<NLFilterUiState>((set) => ({
  visible: false,
  toggle: () => set((s) => ({ visible: !s.visible })),
  setVisible: (v) => set({ visible: v }),
}))
