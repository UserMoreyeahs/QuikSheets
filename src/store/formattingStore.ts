'use client'

/**
 * formattingStore — narrowed delegating wrapper over useSheetStore for
 * the cell-formatting slice.
 *
 * Design (Wave 4 additive split): useSheetStore remains the single source
 * of truth with its full API intact (zero breakage for the 30+ existing
 * consumers). This module exposes a narrower hook so NEW consumers can
 * subscribe to just the formatting fields they care about without picking
 * up an over-subscription to unrelated slices like undo/redo or filters.
 *
 * Selector contract is the same as Zustand's: `useFormattingStore(selector)`
 * returns whatever the selector returns, re-renders only when that result
 * changes by Object.is — IDENTICAL semantics to picking the same fields
 * out of useSheetStore directly.
 */

import { useSheetStore } from './sheetStore'
import type { ActiveFormatting } from '@/types/sheet.types'

export interface FormattingSlice {
  activeFormatting: ActiveFormatting
  setActiveFormatting: (formatting: Partial<ActiveFormatting>) => void
  applyFormatToSelection: (formatting: Partial<ActiveFormatting>) => void
  clearFormatOnSelection: () => void
  resetFormatting: () => void
}

function pickFormattingSlice(s: ReturnType<typeof useSheetStore.getState>): FormattingSlice {
  return {
    activeFormatting: s.activeFormatting,
    setActiveFormatting: s.setActiveFormatting,
    applyFormatToSelection: s.applyFormatToSelection,
    clearFormatOnSelection: s.clearFormatOnSelection,
    resetFormatting: s.resetFormatting,
  }
}

export function useFormattingStore<T>(selector: (slice: FormattingSlice) => T): T {
  return useSheetStore((s) => selector(pickFormattingSlice(s)))
}

/** Imperative read — mirrors useSheetStore.getState() for the formatting slice. */
useFormattingStore.getState = (): FormattingSlice => pickFormattingSlice(useSheetStore.getState())
