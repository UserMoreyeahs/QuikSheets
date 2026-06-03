'use client'

import { create } from 'zustand'

interface GoalSeekState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useGoalSeekStore = create<GoalSeekState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
