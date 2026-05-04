'use client'

import { create } from 'zustand'

interface CommentsUiState {
  /** Right-side panel showing all comments for the active sheet. */
  panelOpen: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void

  /** Floating "add comment" popover anchored to a specific cell. */
  composer: { sheetId: string; cellAddress: string } | null
  openComposer: (target: { sheetId: string; cellAddress: string }) => void
  closeComposer: () => void

  /** Bumps every time comments mutate so consumers re-read localStorage. */
  version: number
  bump: () => void
}

export const useCommentsUiStore = create<CommentsUiState>((set) => ({
  panelOpen: false,
  openPanel:  () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  composer: null,
  openComposer: (target) => set({ composer: target }),
  closeComposer: () => set({ composer: null }),

  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}))
