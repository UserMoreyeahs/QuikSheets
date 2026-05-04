'use client'

/**
 * SlicerPanel
 * -----------
 * Excel-style slicer — a floating panel with clickable value buttons.
 * Clicking a value toggles its inclusion; selected values act as a
 * filter on the connected pivot table. Multi-select with Ctrl+click.
 *
 * - "List" kind: shows clickable buttons for each distinct value.
 * - "Timeline" kind: shows a date-range slider for date columns.
 */

import { useRef, useState, useCallback } from 'react'
import { Filter, X, RotateCcw } from 'lucide-react'
import { useSlicerStore, type SlicerInstance } from '../store/slicerStore'
import { cn } from '@/lib/utils'

export function SlicerPanel({ slicer }: { slicer: SlicerInstance }) {
  const { moveSlicer, resizeSlicer, toggleValue, clearSelection, removeSlicer } = useSlicerStore()

  // ── drag ──────────────────────────────────────────────────────────
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: slicer.x, origY: slicer.y }
      const onMove = (me: MouseEvent) => {
        if (!dragRef.current) return
        moveSlicer(
          slicer.id,
          dragRef.current.origX + (me.clientX - dragRef.current.startX),
          dragRef.current.origY + (me.clientY - dragRef.current.startY)
        )
      }
      const onUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [slicer.id, slicer.x, slicer.y, moveSlicer]
  )

  // ── resize ────────────────────────────────────────────────────────
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: slicer.width, origH: slicer.height }
      const onMove = (me: MouseEvent) => {
        if (!resizeRef.current) return
        resizeSlicer(
          slicer.id,
          resizeRef.current.origW + (me.clientX - resizeRef.current.startX),
          resizeRef.current.origH + (me.clientY - resizeRef.current.startY)
        )
      }
      const onUp = () => {
        resizeRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [slicer.id, slicer.width, slicer.height, resizeSlicer]
  )

  const [search, setSearch] = useState('')
  const filtered = search
    ? slicer.allValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : slicer.allValues

  const activeCount = slicer.selected.length

  if (slicer.kind === 'timeline') {
    return (
      <TimelineSlicer
        slicer={slicer}
        onDragStart={onDragStart}
        onResizeStart={onResizeStart}
      />
    )
  }

  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: slicer.x, top: slicer.y, width: slicer.width, height: slicer.height }}
    >
      {/* Header */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <Filter className="h-3.5 w-3.5 text-blue-500" />
        <span className="flex-1 truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">
          {slicer.label}
        </span>
        {activeCount > 0 && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {activeCount}
          </span>
        )}
        <button
          type="button"
          onClick={() => clearSelection(slicer.id)}
          title="Clear filter"
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => removeSlicer(slicer.id)}
          title="Remove slicer"
          className="rounded p-0.5 text-zinc-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Search */}
      {slicer.allValues.length > 8 && (
        <div className="border-b border-zinc-100 px-2 py-1 dark:border-zinc-800">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded bg-zinc-50 px-2 py-1 text-[11px] outline-none focus:bg-blue-50 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:bg-blue-900/20"
          />
        </div>
      )}

      {/* Value buttons */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-1 gap-0.5">
          {filtered.map((v) => {
            const isActive = slicer.selected.length === 0 || slicer.selected.includes(v)
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleValue(slicer.id, v)}
                className={cn(
                  'rounded px-2 py-1 text-left text-[12px] font-medium transition-colors',
                  isActive
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60'
                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700'
                )}
              >
                {v || '(blank)'}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-4 text-center text-[11px] italic text-zinc-400">No matching values.</div>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
        style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(156,163,175,0.5) 50%)' }}
      />
    </div>
  )
}

// ── Timeline Slicer ──────────────────────────────────────────────────

function TimelineSlicer({
  slicer,
  onDragStart,
  onResizeStart,
}: {
  slicer: SlicerInstance
  onDragStart: (e: React.MouseEvent) => void
  onResizeStart: (e: React.MouseEvent) => void
}) {
  const { setSelected, clearSelection, removeSlicer } = useSlicerStore()

  // Parse dates and sort
  const dates = slicer.allValues
    .map((v) => ({ raw: v, time: new Date(v).getTime() }))
    .filter((d) => !isNaN(d.time))
    .sort((a, b) => a.time - b.time)

  const minTime = dates[0]?.time ?? 0
  const maxTime = dates[dates.length - 1]?.time ?? 0
  const range = maxTime - minTime || 1

  // Current selection range
  const selectedDates = slicer.selected
    .map((v) => new Date(v).getTime())
    .filter((t) => !isNaN(t))
  const selMin = selectedDates.length > 0 ? Math.min(...selectedDates) : minTime
  const selMax = selectedDates.length > 0 ? Math.max(...selectedDates) : maxTime

  const leftPct = ((selMin - minTime) / range) * 100
  const widthPct = ((selMax - selMin) / range) * 100

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const clickedTime = minTime + pct * range

    // Find the closest date
    let closest = dates[0]
    let minDist = Infinity
    for (const d of dates) {
      const dist = Math.abs(d.time - clickedTime)
      if (dist < minDist) { minDist = dist; closest = d }
    }
    if (!closest) return

    // Select range from min to clicked date (or extend)
    if (e.shiftKey && slicer.selected.length > 0) {
      const anchorTime = new Date(slicer.selected[0] ?? '').getTime()
      const lo = Math.min(anchorTime, closest.time)
      const hi = Math.max(anchorTime, closest.time)
      const inRange = dates.filter((d) => d.time >= lo && d.time <= hi).map((d) => d.raw)
      setSelected(slicer.id, inRange)
    } else {
      setSelected(slicer.id, [closest.raw])
    }
  }

  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: slicer.x, top: slicer.y, width: slicer.width, height: slicer.height }}
    >
      {/* Header */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
      >
        <Filter className="h-3.5 w-3.5 text-amber-500" />
        <span className="flex-1 truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-200">
          {slicer.label} (Timeline)
        </span>
        <button
          type="button"
          onClick={() => clearSelection(slicer.id)}
          title="Clear filter"
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => removeSlicer(slicer.id)}
          title="Remove slicer"
          className="rounded p-0.5 text-zinc-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Timeline bar */}
      <div className="flex-1 flex flex-col justify-center px-4 py-3">
        {dates.length >= 2 ? (
          <>
            <div className="mb-2 flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
              <span>{new Date(minTime).toLocaleDateString()}</span>
              <span>{new Date(maxTime).toLocaleDateString()}</span>
            </div>
            <div
              className="relative h-6 cursor-pointer rounded-full bg-zinc-100 dark:bg-zinc-800"
              onClick={handleBarClick}
            >
              {/* Selected range highlight */}
              <div
                className="absolute top-0 h-full rounded-full bg-amber-400/60 dark:bg-amber-600/40"
                style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
              />
              {/* Date markers */}
              {dates.map((d, i) => {
                const pct = ((d.time - minTime) / range) * 100
                const isSelected = slicer.selected.includes(d.raw)
                return (
                  <div
                    key={i}
                    className={cn(
                      'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors',
                      isSelected
                        ? 'border-amber-600 bg-amber-400 dark:border-amber-400 dark:bg-amber-600'
                        : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-700'
                    )}
                    style={{ left: `${pct}%` }}
                  />
                )
              })}
            </div>
            {slicer.selected.length > 0 && (
              <div className="mt-2 text-center text-[10px] font-medium text-amber-700 dark:text-amber-300">
                {slicer.selected.length === 1
                  ? new Date(slicer.selected[0] ?? '').toLocaleDateString()
                  : `${new Date(selMin).toLocaleDateString()} – ${new Date(selMax).toLocaleDateString()}`}
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-[11px] italic text-zinc-400">
            Not enough date values for a timeline.
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
        style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(156,163,175,0.5) 50%)' }}
      />
    </div>
  )
}
