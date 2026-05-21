'use client'

import { create } from 'zustand'
import type { FormulaCategory } from '../formulaList'

interface InsertFunctionState {
  open: boolean
  /**
   * When set, the dialog pre-filters to this category. Used by Formulas-tab
   * buttons (Financial, Logical, Text, Date & Time, Lookup & Ref, Math & Trig)
   * so each one opens the dialog scoped to that category instead of dumping
   * the user into "All" and forcing them to filter manually.
   */
  initialCategory: 'All' | FormulaCategory | null
  setOpen: (open: boolean, initialCategory?: 'All' | FormulaCategory | null) => void
  toggle: () => void
}

export const useInsertFunctionStore = create<InsertFunctionState>()((set) => ({
  open: false,
  initialCategory: null,
  setOpen: (open, initialCategory = null) => set({ open, initialCategory }),
  toggle: () => set((s) => ({ open: !s.open, initialCategory: null })),
}))
