'use client'

import { create } from 'zustand'

export type SlicerKind = 'list' | 'timeline'

export interface SlicerInstance {
  id: string
  /** Human label shown in the slicer header. */
  label: string
  kind: SlicerKind
  /** The pivot table ID this slicer is connected to. */
  pivotId: string
  /** The column index within the pivot source data that this slicer filters. */
  columnIndex: number
  /** All distinct values available in the column. */
  allValues: string[]
  /** Currently selected values (empty = all pass). */
  selected: string[]
  /** Position on screen. */
  x: number
  y: number
  width: number
  height: number
}

interface SlicerState {
  slicers: SlicerInstance[]
  addSlicer: (slicer: Omit<SlicerInstance, 'id'>) => string
  removeSlicer: (id: string) => void
  moveSlicer: (id: string, x: number, y: number) => void
  resizeSlicer: (id: string, width: number, height: number) => void
  toggleValue: (id: string, value: string) => void
  setSelected: (id: string, selected: string[]) => void
  clearSelection: (id: string) => void
  selectAll: (id: string) => void
  /** Returns all active slicer filters for a given pivot ID. */
  getFiltersForPivot: (pivotId: string) => Array<{ column: number; allowed: string[] }>
}

export const useSlicerStore = create<SlicerState>((set, get) => ({
  slicers: [],

  addSlicer: (slicer) => {
    const id = crypto.randomUUID()
    set((s) => ({ slicers: [...s.slicers, { ...slicer, id }] }))
    return id
  },

  removeSlicer: (id) =>
    set((s) => ({ slicers: s.slicers.filter((sl) => sl.id !== id) })),

  moveSlicer: (id, x, y) =>
    set((s) => ({
      slicers: s.slicers.map((sl) => (sl.id === id ? { ...sl, x, y } : sl)),
    })),

  resizeSlicer: (id, width, height) =>
    set((s) => ({
      slicers: s.slicers.map((sl) =>
        sl.id === id ? { ...sl, width: Math.max(160, width), height: Math.max(120, height) } : sl
      ),
    })),

  toggleValue: (id, value) =>
    set((s) => ({
      slicers: s.slicers.map((sl) => {
        if (sl.id !== id) return sl
        const isSelected = sl.selected.includes(value)
        const selected = isSelected
          ? sl.selected.filter((v) => v !== value)
          : [...sl.selected, value]
        return { ...sl, selected }
      }),
    })),

  setSelected: (id, selected) =>
    set((s) => ({
      slicers: s.slicers.map((sl) => (sl.id === id ? { ...sl, selected } : sl)),
    })),

  clearSelection: (id) =>
    set((s) => ({
      slicers: s.slicers.map((sl) => (sl.id === id ? { ...sl, selected: [] } : sl)),
    })),

  selectAll: (id) =>
    set((s) => ({
      slicers: s.slicers.map((sl) =>
        sl.id === id ? { ...sl, selected: [...sl.allValues] } : sl
      ),
    })),

  getFiltersForPivot: (pivotId: string) => {
    return get()
      .slicers.filter((sl) => sl.pivotId === pivotId && sl.selected.length > 0)
      .map((sl) => ({ column: sl.columnIndex, allowed: sl.selected }))
  },
}))
