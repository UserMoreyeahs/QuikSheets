'use client'

import { create } from 'zustand'
import type { ChartConfig } from '../types'

export interface InsertedChart {
  id: string
  /** Display name for the chart panel header. */
  name: string
  /** A1-style range string, e.g. "A1:E20" — sheet is implicit (active sheet at insert time). */
  sourceRange: string
  /** Sheet ID this chart was inserted from. */
  sheetId: string
  config: ChartConfig
  /** Floating panel position (top-left of the panel within the grid container). */
  x: number
  y: number
  /** Cell anchor — chart scrolls with this cell. Row index in the sheet. */
  anchorRow: number
  /** Cell anchor — chart scrolls with this cell. Column index in the sheet. */
  anchorCol: number
}

interface ChartPanelState {
  // Builder modal open/close
  builderOpen: boolean
  openBuilder:  () => void
  closeBuilder: () => void

  // Inserted charts (in-memory; persists across the session, lost on reload)
  charts: InsertedChart[]
  addChart:    (chart: Omit<InsertedChart, 'id' | 'x' | 'y'>) => void
  removeChart: (id: string) => void
  moveChart:   (id: string, x: number, y: number) => void
}

let nextOffset = 0

export const useChartPanelStore = create<ChartPanelState>((set) => ({
  builderOpen: false,
  openBuilder:  () => set({ builderOpen: true }),
  closeBuilder: () => set({ builderOpen: false }),

  charts: [],
  addChart: (chart) =>
    set((state) => {
      // stagger position so multiple charts don't overlap perfectly
      nextOffset = (nextOffset + 30) % 200
      const newChart: InsertedChart = {
        ...chart,
        id: crypto.randomUUID(),
        x: 80 + nextOffset,
        y: 140 + nextOffset,
        anchorRow: 0,
        anchorCol: 2,
      }
      return { charts: [...state.charts, newChart] }
    }),
  removeChart: (id) =>
    set((state) => ({ charts: state.charts.filter((c) => c.id !== id) })),
  moveChart: (id, x, y) =>
    set((state) => ({
      charts: state.charts.map((c) => (c.id === id ? { ...c, x, y } : c)),
    })),
}))
