'use client'

import { create } from 'zustand'
import type { AdvancedFilterCriteria } from '../utils/advancedFilter'

/**
 * Advanced Filter state lives in its OWN store so it can be applied per
 * sheet without entangling the regular `activeFilters` array on
 * `sheetStore`. The two filter mechanisms compose at row-hide time:
 * a row is hidden if EITHER the basic filter OR the advanced filter says so.
 *
 * Per-sheet keying lets the user keep a different criteria range on each
 * tab and have the right one re-applied when switching tabs.
 */
interface AdvancedFilterState {
  /** Whether the criteria-builder dialog is currently open. */
  dialogOpen: boolean
  /** Active criteria, keyed by sheet id (workbookStore.activeSheetId). */
  criteriaBySheet: Record<string, AdvancedFilterCriteria>

  openDialog: () => void
  closeDialog: () => void
  setCriteria: (sheetId: string, criteria: AdvancedFilterCriteria) => void
  clearCriteria: (sheetId: string) => void
}

export const useAdvancedFilterStore = create<AdvancedFilterState>((set) => ({
  dialogOpen: false,
  criteriaBySheet: {},

  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),

  setCriteria: (sheetId, criteria) =>
    set((state) => ({
      criteriaBySheet: { ...state.criteriaBySheet, [sheetId]: criteria },
    })),

  clearCriteria: (sheetId) =>
    set((state) => {
      const next = { ...state.criteriaBySheet }
      delete next[sheetId]
      return { criteriaBySheet: next }
    }),
}))
