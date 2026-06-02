'use client'

/**
 * DashboardBuilder — modal dialog for creating / editing a dashboard.
 *
 * Toolbar: + Add KPI | + Add Chart | + Add Text | + Add Table
 * Canvas: DashboardCanvas in editable mode
 *
 * When opened for an existing dashboard (`editingDashboardId` is set), the
 * builder edits that dashboard in-place.  For a new dashboard it first
 * prompts for a name and then opens the canvas.
 */

import { useEffect, useRef, useState } from 'react'
import { X, BarChart3, Table, Type, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useDashboardStore, makeKpiWidget, makeChartWidget, makeTextWidget, makeTableWidget } from '../store/dashboardStore'
import { DashboardCanvas } from './DashboardCanvas'

export function DashboardBuilder() {
  const open = useDashboardStore((s) => s.builderOpen)
  const editingId = useDashboardStore((s) => s.editingDashboardId)
  const dashboards = useDashboardStore((s) => s.dashboards)
  const closeBuilder = useDashboardStore((s) => s.closeBuilder)
  const createDashboard = useDashboardStore((s) => s.create)
  const addWidget = useDashboardStore((s) => s.addWidget)
  const renameDashboard = useDashboardStore((s) => s.rename)

  const [nameInput, setNameInput] = useState('')
  const [phase, setPhase] = useState<'name' | 'canvas'>('name')
  const [activeDashId, setActiveDashId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  // Reset when builder opens
  useEffect(() => {
    if (!open) return
    if (editingId) {
      // Editing existing — jump straight to canvas
      const dash = dashboards.find((d) => d.id === editingId)
      if (dash) {
        setNameInput(dash.name)
        setActiveDashId(editingId)
        setPhase('canvas')
      }
    } else {
      setNameInput('')
      setActiveDashId(null)
      setPhase('name')
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId])

  if (!open) return null

  const activeDash = dashboards.find((d) => d.id === activeDashId)

  function handleCreate() {
    const name = nameInput.trim()
    if (!name) {
      toast.error('Enter a dashboard name.')
      return
    }
    createDashboard(name)
    // The store adds the dashboard synchronously — pick the last one (just added)
    // We rely on the store state being updated before we read it here.
    // Use a tiny timeout to let state settle.
    setTimeout(() => {
      const latest = useDashboardStore.getState().dashboards
      const newDash = latest[latest.length - 1]
      if (newDash) {
        setActiveDashId(newDash.id)
        setPhase('canvas')
      }
    }, 0)
  }

  function handleAddKpi() {
    if (!activeDash) return
    addWidget(activeDash.id, makeKpiWidget(activeDash.widgets))
  }

  function handleAddChart() {
    if (!activeDash) return
    addWidget(activeDash.id, makeChartWidget(activeDash.widgets))
  }

  function handleAddText() {
    if (!activeDash) return
    addWidget(activeDash.id, makeTextWidget(activeDash.widgets))
  }

  function handleAddTable() {
    if (!activeDash) return
    addWidget(activeDash.id, makeTableWidget(activeDash.widgets))
  }

  function handleRename() {
    if (!activeDash) return
    const name = nameInput.trim()
    if (!name) return
    renameDashboard(activeDash.id, name)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          {phase === 'canvas' ? (
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
              className="bg-transparent text-sm font-semibold text-zinc-900 outline-none focus:border-b focus:border-blue-400 dark:text-zinc-100"
            />
          ) : (
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              New Dashboard
            </h2>
          )}
          <button
            type="button"
            onClick={closeBuilder}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Phase: name input */}
        {phase === 'name' && (
          <div className="flex flex-col items-center justify-center gap-4 p-12">
            <div className="w-full max-w-sm space-y-3">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Dashboard name
              </label>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Q2 Sales Overview"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleCreate}
                className="w-full rounded-md bg-blue-600 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                Create Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Phase: canvas editor */}
        {phase === 'canvas' && activeDash && (
          <>
            {/* widget toolbar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-2">
                Add
              </span>
              {([
                { label: 'KPI', icon: <Hash className="h-3.5 w-3.5" />, onClick: handleAddKpi },
                { label: 'Chart', icon: <BarChart3 className="h-3.5 w-3.5" />, onClick: handleAddChart },
                { label: 'Text', icon: <Type className="h-3.5 w-3.5" />, onClick: handleAddText },
                { label: 'Table', icon: <Table className="h-3.5 w-3.5" />, onClick: handleAddTable },
              ] as const).map(({ label, icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium',
                    'text-zinc-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
                    'dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
              <div className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-500">
                Drag to move · drag corner to resize
              </div>
            </div>

            {/* canvas */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-800/30">
              {activeDash.widgets.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-[13px] text-zinc-400 dark:border-zinc-700">
                  Click + Add above to insert your first widget.
                </div>
              ) : (
                <DashboardCanvas dashboard={activeDash} editable />
              )}
            </div>

            {/* footer */}
            <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <button
                type="button"
                onClick={closeBuilder}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={closeBuilder}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Save & Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
