'use client'

/**
 * Dashboard Zustand Store — Advanced Dashboards (P2 #32).
 *
 * Manages dashboards for the current workbook.
 * Persistence: Supabase-first via dashboardsApi, with localStorage fallback.
 *
 * Follows the same structural pattern as cfStore.ts.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Dashboard, Widget } from '../types'
import { makeDefaultLayout } from '../types'
import {
  loadDashboards,
  saveDashboard,
  deleteDashboard as apiDeleteDashboard,
} from '@/lib/dashboardsApi'

// ---------------------------------------------------------------------------
// State + Actions interface
// ---------------------------------------------------------------------------

interface DashboardState {
  /** All dashboards for the active workbook. */
  dashboards: Dashboard[]
  /** The ID of the dashboard currently visible in the canvas. */
  activeDashboardId: string | null
  /** Whether the builder modal is open. */
  builderOpen: boolean
  /** When the builder is opened to edit an existing dashboard, store its ID. */
  editingDashboardId: string | null
  /** workbook context (set by loadDashboards). */
  workbookId: string | null
}

interface DashboardActions {
  /** Load all dashboards for a workbook from Supabase (or fallback). */
  load: (workbookId: string) => Promise<void>

  /** Create a new blank dashboard. */
  create: (name: string) => void

  /** Rename a dashboard. */
  rename: (id: string, name: string) => void

  /** Delete a dashboard. */
  delete: (id: string) => void

  /** Add a widget to a dashboard. */
  addWidget: (dashboardId: string, widget: Widget) => void

  /** Replace a widget (used by the per-widget edit dialog). */
  updateWidget: (dashboardId: string, widgetId: string, updates: Partial<Widget>) => void

  /** Remove a widget from a dashboard. */
  removeWidget: (dashboardId: string, widgetId: string) => void

  /**
   * Update the layout (x/y/w/h) of a widget after a drag or resize.
   * Called by the canvas on pointer-up.
   */
  setLayout: (dashboardId: string, widgetId: string, layout: { x: number; y: number; w: number; h: number }) => void

  /** Open the dashboard builder (create new or edit existing). */
  openBuilder: (dashboardId?: string) => void
  closeBuilder: () => void

  /** Set the currently visible dashboard. */
  setActive: (id: string | null) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  devtools(
    (set, get) => ({
      dashboards: [],
      activeDashboardId: null,
      builderOpen: false,
      editingDashboardId: null,
      workbookId: null,

      async load(workbookId) {
        const dashboards = await loadDashboards(workbookId)
        set({ workbookId, dashboards }, false, 'dashboard/load')
      },

      create(name) {
        const now = new Date().toISOString()
        const dashboard: Dashboard = {
          id: crypto.randomUUID(),
          workbookId: get().workbookId ?? '',
          name,
          widgets: [],
          createdAt: now,
          updatedAt: now,
        }
        set(
          (state) => ({ dashboards: [...state.dashboards, dashboard] }),
          false,
          'dashboard/create'
        )
        const { workbookId } = get()
        if (workbookId) void saveDashboard(workbookId, dashboard)
      },

      rename(id, name) {
        let updated: Dashboard | undefined
        set(
          (state) => {
            const dashboards = state.dashboards.map((d) => {
              if (d.id !== id) return d
              updated = { ...d, name, updatedAt: new Date().toISOString() }
              return updated
            })
            return { dashboards }
          },
          false,
          'dashboard/rename'
        )
        const { workbookId } = get()
        if (workbookId && updated) void saveDashboard(workbookId, updated)
      },

      delete(id) {
        const { workbookId, activeDashboardId } = get()
        set(
          (state) => ({
            dashboards: state.dashboards.filter((d) => d.id !== id),
            activeDashboardId: activeDashboardId === id ? null : activeDashboardId,
          }),
          false,
          'dashboard/delete'
        )
        if (workbookId) void apiDeleteDashboard(workbookId, id)
      },

      addWidget(dashboardId, widget) {
        let updated: Dashboard | undefined
        set(
          (state) => {
            const dashboards = state.dashboards.map((d) => {
              if (d.id !== dashboardId) return d
              updated = { ...d, widgets: [...d.widgets, widget], updatedAt: new Date().toISOString() }
              return updated
            })
            return { dashboards }
          },
          false,
          'dashboard/addWidget'
        )
        const { workbookId } = get()
        if (workbookId && updated) void saveDashboard(workbookId, updated)
      },

      updateWidget(dashboardId, widgetId, updates) {
        let updated: Dashboard | undefined
        set(
          (state) => {
            const dashboards = state.dashboards.map((d) => {
              if (d.id !== dashboardId) return d
              const widgets = d.widgets.map((w) => {
                if (w.id !== widgetId) return w
                // Merge updates — safe because Widget is a discriminated union
                // and we only update fields that exist on the current kind.
                return { ...w, ...updates } as Widget
              })
              updated = { ...d, widgets, updatedAt: new Date().toISOString() }
              return updated
            })
            return { dashboards }
          },
          false,
          'dashboard/updateWidget'
        )
        const { workbookId } = get()
        if (workbookId && updated) void saveDashboard(workbookId, updated)
      },

      removeWidget(dashboardId, widgetId) {
        let updated: Dashboard | undefined
        set(
          (state) => {
            const dashboards = state.dashboards.map((d) => {
              if (d.id !== dashboardId) return d
              updated = {
                ...d,
                widgets: d.widgets.filter((w) => w.id !== widgetId),
                updatedAt: new Date().toISOString(),
              }
              return updated
            })
            return { dashboards }
          },
          false,
          'dashboard/removeWidget'
        )
        const { workbookId } = get()
        if (workbookId && updated) void saveDashboard(workbookId, updated)
      },

      setLayout(dashboardId, widgetId, layout) {
        let updated: Dashboard | undefined
        set(
          (state) => {
            const dashboards = state.dashboards.map((d) => {
              if (d.id !== dashboardId) return d
              const widgets = d.widgets.map((w) =>
                w.id === widgetId ? { ...w, layout } : w
              )
              updated = { ...d, widgets, updatedAt: new Date().toISOString() }
              return updated
            })
            return { dashboards }
          },
          false,
          'dashboard/setLayout'
        )
        const { workbookId } = get()
        if (workbookId && updated) void saveDashboard(workbookId, updated)
      },

      openBuilder(dashboardId) {
        set(
          { builderOpen: true, editingDashboardId: dashboardId ?? null },
          false,
          'dashboard/openBuilder'
        )
      },

      closeBuilder() {
        set({ builderOpen: false, editingDashboardId: null }, false, 'dashboard/closeBuilder')
      },

      setActive(id) {
        set({ activeDashboardId: id }, false, 'dashboard/setActive')
      },
    }),
    { name: 'DashboardStore' }
  )
)

// ---------------------------------------------------------------------------
// Selector helpers
// ---------------------------------------------------------------------------

/** Get the active Dashboard object, or null. */
export function selectActiveDashboard(
  state: DashboardState & DashboardActions
): Dashboard | null {
  return state.dashboards.find((d) => d.id === state.activeDashboardId) ?? null
}

/** Get a dashboard by id. */
export function selectDashboardById(
  state: DashboardState & DashboardActions,
  id: string
): Dashboard | null {
  return state.dashboards.find((d) => d.id === id) ?? null
}

// ---------------------------------------------------------------------------
// Factory helpers used by the builder
// ---------------------------------------------------------------------------

export function makeKpiWidget(
  existingWidgets: import('../types').Widget[]
): import('../types').KpiWidget {
  return {
    id: crypto.randomUUID(),
    kind: 'kpi',
    title: 'KPI',
    range: 'A1:A10',
    aggregate: 'sum',
    format: 'number',
    layout: makeDefaultLayout(existingWidgets, 3, 2),
  }
}

export function makeChartWidget(
  existingWidgets: import('../types').Widget[]
): import('../types').ChartWidget {
  return {
    id: crypto.randomUUID(),
    kind: 'chart',
    title: 'Chart',
    range: 'A1:D10',
    hasHeader: true,
    sheetId: '',
    chartType: 'bar',
    categoryColumn: 0,
    seriesColumns: [1],
    layout: makeDefaultLayout(existingWidgets, 6, 4),
  }
}

export function makeTextWidget(
  existingWidgets: import('../types').Widget[]
): import('../types').TextWidget {
  return {
    id: crypto.randomUUID(),
    kind: 'text',
    content: 'Add your text here…',
    layout: makeDefaultLayout(existingWidgets, 4, 1),
  }
}

export function makeTableWidget(
  existingWidgets: import('../types').Widget[]
): import('../types').TableWidget {
  return {
    id: crypto.randomUUID(),
    kind: 'table',
    title: 'Table',
    range: 'A1:E10',
    hasHeader: true,
    maxRows: 10,
    layout: makeDefaultLayout(existingWidgets, 6, 4),
  }
}
