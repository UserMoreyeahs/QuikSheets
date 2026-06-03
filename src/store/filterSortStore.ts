'use client'

/**
 * filterSortStore — narrowed delegating wrapper over useSheetStore for
 * the sort + filter + hidden-rows + advanced-filter + outline slices.
 *
 * Design — see formattingStore.ts for the additive-split rationale.
 * useSheetStore remains the single source of truth; this hook exposes
 * a narrower API for new consumers to subscribe to.
 */

import { useSheetStore } from './sheetStore'
import type { SortConfig, FilterRule } from '@/types/sheet.types'
import type { AdvancedFilterCriteria } from '@/features/data/utils/advancedFilter'

export interface FilterSortSlice {
  sortConfig: SortConfig | null
  applySort: (config: SortConfig) => void
  setSortConfig: (config: SortConfig | null) => void
  activeFilters: FilterRule[]
  setActiveFilters: (filters: FilterRule[]) => void
  addFilter: (filter: FilterRule) => void
  removeFilter: (columnIndex: number) => void
  clearFilters: () => void
  hiddenRows: number[]
  setHiddenRows: (rows: number[]) => void
  applyAdvancedFilterToActiveSheet: (criteria: AdvancedFilterCriteria | null) => void
  outlineHiddenRowsBySheet: Record<string, number[]>
  setOutlineHiddenRows: (sheetId: string, rows: number[]) => void
}

function pickFilterSortSlice(s: ReturnType<typeof useSheetStore.getState>): FilterSortSlice {
  return {
    sortConfig: s.sortConfig,
    applySort: s.applySort,
    setSortConfig: s.setSortConfig,
    activeFilters: s.activeFilters,
    setActiveFilters: s.setActiveFilters,
    addFilter: s.addFilter,
    removeFilter: s.removeFilter,
    clearFilters: s.clearFilters,
    hiddenRows: s.hiddenRows,
    setHiddenRows: s.setHiddenRows,
    applyAdvancedFilterToActiveSheet: s.applyAdvancedFilterToActiveSheet,
    outlineHiddenRowsBySheet: s.outlineHiddenRowsBySheet,
    setOutlineHiddenRows: s.setOutlineHiddenRows,
  }
}

export function useFilterSortStore<T>(selector: (slice: FilterSortSlice) => T): T {
  return useSheetStore((s) => selector(pickFilterSortSlice(s)))
}

/** Imperative read — mirrors useSheetStore.getState() for the filter/sort slice. */
useFilterSortStore.getState = (): FilterSortSlice => pickFilterSortSlice(useSheetStore.getState())
