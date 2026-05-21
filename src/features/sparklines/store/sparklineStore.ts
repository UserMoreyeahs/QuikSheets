'use client'

import { create } from 'zustand'

export type SparklineKind = 'line' | 'column' | 'win_loss'

export interface InsertedSparkline {
  id: string
  /** Sheet the sparkline belongs to. */
  sheetId: string
  /** Cell that the sparkline is rendered over (row, col). */
  targetRow: number
  targetCol: number
  /** Source data range in A1 notation (e.g. "B2:F2"). */
  sourceRange: string
  kind: SparklineKind
  /** Optional explicit color override. */
  color?: string | undefined
}

interface SparklineBuilderState {
  /** Dialog open state. */
  open: boolean
  /** Kind selected when the user clicked Insert > Sparklines > X. */
  initialKind: SparklineKind
  openBuilder: (kind: SparklineKind) => void
  closeBuilder: () => void
}

interface SparklineState {
  sparklines: InsertedSparkline[]
  add: (s: Omit<InsertedSparkline, 'id'>) => void
  remove: (id: string) => void
}

export const useSparklineStore = create<SparklineState>((set) => ({
  sparklines: [],
  add: (s) =>
    set((state) => ({
      sparklines: [
        ...state.sparklines,
        { ...s, id: crypto.randomUUID() },
      ],
    })),
  remove: (id) =>
    set((state) => ({ sparklines: state.sparklines.filter((sp) => sp.id !== id) })),
}))

export const useSparklineBuilderStore = create<SparklineBuilderState>((set) => ({
  open: false,
  initialKind: 'line',
  openBuilder: (kind) => set({ open: true, initialKind: kind }),
  closeBuilder: () => set({ open: false }),
}))
