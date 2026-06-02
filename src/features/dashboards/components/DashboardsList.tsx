'use client'

/**
 * DashboardsList — grid of dashboard cards for the current workbook.
 *
 * Shows name, last-modified, widget count, and a thumbnail-style preview.
 * Clicking a card opens the DashboardCanvas (read-only).
 * "New Dashboard" button opens DashboardBuilder.
 * "Edit" on a card re-opens DashboardBuilder in edit mode.
 */

import { useMemo, useState } from 'react'
import { BarChart3, Hash, Layers, LayoutDashboard, Pencil, Plus, Table, Trash2, Type, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useDashboardStore } from '../store/dashboardStore'
import { DashboardCanvas } from './DashboardCanvas'
import type { Dashboard, Widget } from '../types'

interface DashboardsListProps {
  /** Called when the list panel should close (e.g. user presses Escape). */
  onClose?: () => void
}

export function DashboardsList({ onClose }: DashboardsListProps) {
  const dashboards = useDashboardStore((s) => s.dashboards)
  const openBuilder = useDashboardStore((s) => s.openBuilder)
  const deleteDashboard = useDashboardStore((s) => s.delete)

  const [viewingId, setViewingId] = useState<string | null>(null)

  const viewingDash = useMemo(
    () => (viewingId ? (dashboards.find((d) => d.id === viewingId) ?? null) : null),
    [viewingId, dashboards]
  )

  // If the user deleted the dashboard they were viewing, close it.
  if (viewingId && !viewingDash) {
    setViewingId(null)
  }

  function handleDelete(d: Dashboard) {
    if (!window.confirm(`Delete dashboard "${d.name}"?`)) return
    deleteDashboard(d.id)
    toast.success(`Dashboard "${d.name}" deleted.`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          {viewingDash ? (
            <button
              type="button"
              onClick={() => setViewingId(null)}
              className="mr-1 rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Back to list"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <LayoutDashboard className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {viewingDash ? viewingDash.name : 'Dashboards'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewingDash && (
            <button
              type="button"
              onClick={() => openBuilder(viewingDash.id)}
              className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {!viewingDash && (
            <button
              type="button"
              onClick={() => openBuilder()}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3 w-3" />
              New Dashboard
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {viewingDash ? (
          /* Read-only canvas view */
          <div className="p-4">
            <DashboardCanvas dashboard={viewingDash} editable={false} />
          </div>
        ) : dashboards.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <LayoutDashboard className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <div className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
              No dashboards yet
            </div>
            <div className="text-[12px] text-zinc-400 dark:text-zinc-500 max-w-xs">
              Create a dashboard to combine KPIs, charts, and tables into a
              single view.
            </div>
            <button
              type="button"
              onClick={() => openBuilder()}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New Dashboard
            </button>
          </div>
        ) : (
          /* Card grid */
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {dashboards.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                onOpen={() => setViewingId(d.id)}
                onEdit={() => openBuilder(d.id)}
                onDelete={() => handleDelete(d)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard card
// ---------------------------------------------------------------------------

interface DashboardCardProps {
  dashboard: Dashboard
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

function DashboardCard({ dashboard, onOpen, onEdit, onDelete }: DashboardCardProps) {
  const updatedAt = useMemo(() => {
    const d = new Date(dashboard.updatedAt)
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [dashboard.updatedAt])

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex flex-col items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm',
        'hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900'
      )}
    >
      {/* Thumbnail area */}
      <div className="flex h-28 items-center justify-center border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
        <WidgetThumbnails widgets={dashboard.widgets} />
      </div>

      {/* Card body */}
      <div className="p-3">
        <div className="mb-0.5 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {dashboard.name}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span>{dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}</span>
          {updatedAt && <span>· Updated {updatedAt}</span>}
        </div>
      </div>

      {/* Hover controls */}
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="rounded bg-white p-1 text-zinc-500 shadow hover:text-blue-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-blue-400"
          aria-label="Edit dashboard"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="rounded bg-white p-1 text-zinc-500 shadow hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-red-400"
          aria-label="Delete dashboard"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Widget thumbnail (icon-only overview)
// ---------------------------------------------------------------------------

const KIND_ICONS: Record<Widget['kind'], React.ReactNode> = {
  kpi: <Hash className="h-4 w-4 text-blue-500" />,
  chart: <BarChart3 className="h-4 w-4 text-emerald-500" />,
  text: <Type className="h-4 w-4 text-zinc-500" />,
  table: <Table className="h-4 w-4 text-amber-500" />,
}

function WidgetThumbnails({ widgets }: { widgets: Widget[] }) {
  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 text-zinc-300 dark:text-zinc-600">
        <Layers className="h-6 w-6" />
        <span className="text-[10px]">Empty</span>
      </div>
    )
  }

  // Show up to 6 widget kind badges
  const shown = widgets.slice(0, 6)
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((w) => (
        <div
          key={w.id}
          className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800"
          title={w.kind === 'kpi' || w.kind === 'chart' || w.kind === 'table' ? (w as { title?: string }).title : w.kind}
        >
          {KIND_ICONS[w.kind]}
          <span className="text-zinc-600 dark:text-zinc-400 capitalize">{w.kind}</span>
        </div>
      ))}
      {widgets.length > 6 && (
        <div className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
          +{widgets.length - 6}
        </div>
      )}
    </div>
  )
}
