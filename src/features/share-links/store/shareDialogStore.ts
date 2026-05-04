'use client'

import { create } from 'zustand'

interface ShareDialogState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useShareDialogStore = create<ShareDialogState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
}))
