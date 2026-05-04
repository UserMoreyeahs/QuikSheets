'use client'

import { create } from 'zustand'

interface FormBuilderState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useFormBuilderStore = create<FormBuilderState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
}))
