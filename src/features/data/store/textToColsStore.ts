'use client'

import { create } from 'zustand'

interface TextToColsState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useTextToColsStore = create<TextToColsState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
