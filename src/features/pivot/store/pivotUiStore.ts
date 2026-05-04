'use client'

import { create } from 'zustand'
import type { PivotConfig, PivotResult } from '../pivotAggregator'

export interface PivotInstance {
  id: string
  /** A1-style range (e.g. "A1:E20") */
  sourceRange: string
  /** Display name shown on the panel header. */
  name: string
  hasHeader: boolean
  config: PivotConfig
  /** Snapshotted result so the panel renders even if the source range changes later. */
  result: PivotResult
  /** Header labels (length === number of source columns). */
  headerLabels: string[]
  /** Scroll anchor — row index. Pivot tracks this cell when scrolling. */
  anchorRow: number
  /** Scroll anchor — column index. */
  anchorCol: number
  /** Offset from anchor (user drag). */
  offsetX: number
  /** Offset from anchor (user drag). */
  offsetY: number
}

interface PivotUiState {
  builderOpen: boolean
  openBuilder:  () => void
  closeBuilder: () => void

  pivots: PivotInstance[]
  addPivot:    (pivot: Omit<PivotInstance, 'id'>) => void
  removePivot: (id: string) => void
  movePivot:   (id: string, offsetX: number, offsetY: number) => void
}

export const usePivotUiStore = create<PivotUiState>((set) => ({
  builderOpen: false,
  openBuilder:  () => set({ builderOpen: true }),
  closeBuilder: () => set({ builderOpen: false }),

  pivots: [],
  addPivot: (pivot) =>
    set((state) => ({
      pivots: [...state.pivots, {
        ...pivot,
        id: crypto.randomUUID(),
        anchorRow: pivot.anchorRow ?? 0,
        anchorCol: pivot.anchorCol ?? 0,
        offsetX: pivot.offsetX ?? 120,
        offsetY: pivot.offsetY ?? 120,
      }],
    })),
  removePivot: (id) =>
    set((state) => ({ pivots: state.pivots.filter((p) => p.id !== id) })),
  movePivot: (id: string, offsetX: number, offsetY: number) =>
    set((state) => ({
      pivots: state.pivots.map((p) => p.id === id ? { ...p, offsetX, offsetY } : p),
    })),
}))
