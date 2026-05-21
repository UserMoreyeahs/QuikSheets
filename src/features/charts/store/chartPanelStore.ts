'use client'

import { create } from 'zustand'
import type { ChartConfig, ChartKind } from '../types'

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
  /**
   * When the builder is opened from the Insert tab's chart-type
   * sub-dropdowns (Column/Bar, Line/Area, etc.), the chosen kind is
   * stashed here so the builder can pre-select that chart type. Null
   * when opened from the generic "Recommended Charts" entry.
   */
  initialKind: ChartKind | null
  openBuilder:  (initialKind?: ChartKind) => void
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
  initialKind: null,
  openBuilder: (initialKind?: ChartKind) => {
    // Guard against accidental call-as-event-handler — when the store
    // action is wired as `onClick={openBuilder}` React passes the click
    // event as the first arg, which the previous version stashed as
    // initialKind. That made the chart's `kind` a synthetic event,
    // which then leaked into ECharts options as `series[0].type`.
    const valid =
      typeof initialKind === 'string' && initialKind.length > 0 ? initialKind : null
    set({ builderOpen: true, initialKind: valid })
  },
  closeBuilder: () => set({ builderOpen: false, initialKind: null }),

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
