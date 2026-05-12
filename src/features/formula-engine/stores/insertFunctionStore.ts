'use client'

import { create } from 'zustand'

interface InsertFunctionState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useInsertFunctionStore = create<InsertFunctionState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
