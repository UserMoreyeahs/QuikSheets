/**
 * Sanity tests for the Wave 4 additive sheetStore split.
 *
 * useSheetStore remains the source of truth; useFormattingStore and
 * useFilterSortStore are narrowed delegating wrappers. These tests
 * verify the wrappers return the SAME values for the SAME fields,
 * and that imperative .getState() mirrors the values too.
 */

import { describe, it, expect } from 'vitest'
import { useSheetStore } from '@/store/sheetStore'
import { useFormattingStore } from '@/store/formattingStore'
import { useFilterSortStore } from '@/store/filterSortStore'

describe('formattingStore (additive split)', () => {
  it('.getState() returns the same activeFormatting as useSheetStore', () => {
    const fromMain = useSheetStore.getState().activeFormatting
    const fromSlice = useFormattingStore.getState().activeFormatting
    expect(fromSlice).toBe(fromMain) // same reference
  })

  it('action references match the main store', () => {
    const main = useSheetStore.getState()
    const slice = useFormattingStore.getState()
    expect(slice.setActiveFormatting).toBe(main.setActiveFormatting)
    expect(slice.applyFormatToSelection).toBe(main.applyFormatToSelection)
    expect(slice.clearFormatOnSelection).toBe(main.clearFormatOnSelection)
    expect(slice.resetFormatting).toBe(main.resetFormatting)
  })

  it('mutations through useSheetStore are visible through useFormattingStore', () => {
    const initial = useFormattingStore.getState().activeFormatting
    useSheetStore.getState().setActiveFormatting({ bold: !initial.bold })
    const after = useFormattingStore.getState().activeFormatting
    expect(after.bold).toBe(!initial.bold)
    // Restore
    useSheetStore.getState().setActiveFormatting({ bold: initial.bold })
  })
})

describe('filterSortStore (additive split)', () => {
  it('.getState() returns the same sortConfig as useSheetStore', () => {
    const fromMain = useSheetStore.getState().sortConfig
    const fromSlice = useFilterSortStore.getState().sortConfig
    expect(fromSlice).toBe(fromMain)
  })

  it('.getState() returns the same activeFilters reference as useSheetStore', () => {
    const fromMain = useSheetStore.getState().activeFilters
    const fromSlice = useFilterSortStore.getState().activeFilters
    expect(fromSlice).toBe(fromMain)
  })

  it('action references match the main store', () => {
    const main = useSheetStore.getState()
    const slice = useFilterSortStore.getState()
    expect(slice.applySort).toBe(main.applySort)
    expect(slice.addFilter).toBe(main.addFilter)
    expect(slice.removeFilter).toBe(main.removeFilter)
    expect(slice.clearFilters).toBe(main.clearFilters)
    expect(slice.applyAdvancedFilterToActiveSheet).toBe(main.applyAdvancedFilterToActiveSheet)
    expect(slice.setOutlineHiddenRows).toBe(main.setOutlineHiddenRows)
  })

  it('hiddenRows reads match between stores', () => {
    expect(useFilterSortStore.getState().hiddenRows).toBe(useSheetStore.getState().hiddenRows)
  })
})
