'use client'

/**
 * PivotsLayer — Excel-style embedded pivot tables.
 *
 *   • drag from header to move
 *   • resize from bottom-right corner
 *   • close from X button
 *   • multi-column header rows when `columns` zone is non-empty
 */

import { useEffect, useRef, useState } from 'react'
import { Filter, X, Table as TableIcon, GripVertical, Calendar } from 'lucide-react'
import { usePivotUiStore, type PivotInstance } from '@/features/pivot/store/pivotUiStore'
import { useSlicerStore } from '@/features/slicers/store/slicerStore'
import { getRangeMatrix } from '@/features/charts/utils/rangeUtils'
import { useGridScroll, cellToPixelPosition } from '@/features/grid/hooks/useGridScroll'
import { useSheetStore } from '@/store/sheetStore'

const DEFAULT_W = 540
const DEFAULT_H = 340

/**
 * Outer component — only subscribes to the pivot list.
 * Heavy hooks (useGridScroll) only mount when pivots exist.
 */
export function PivotsLayer() {
  const pivots = usePivotUiStore((s) => s.pivots)
  if (pivots.length === 0) return null
  return <PivotsLayerInner />
}

/** Inner component — mounts heavy hooks only when pivots exist. */
function PivotsLayerInner() {
  const pivots = usePivotUiStore((s) => s.pivots)
  const removePivot = usePivotUiStore((s) => s.removePivot)
  const movePivot = usePivotUiStore((s) => s.movePivot)
  const scrollOffset = useGridScroll()

  return (
    <>
      {pivots.map((p) => {
        const anchorPos = cellToPixelPosition(p.anchorRow, p.anchorCol, scrollOffset)
        return (
          <PivotPanel
            key={p.id}
            pivot={p}
            defaultLeft={anchorPos.x + p.offsetX}
            defaultTop={anchorPos.y + p.offsetY}
            onClose={() => removePivot(p.id)}
            onMoveOffset={(ox, oy) => movePivot(p.id, ox, oy)}
            anchorPos={anchorPos}
          />
        )
      })}
    </>
  )
}

function PivotPanel({
  pivot, defaultLeft, defaultTop, onClose, onMoveOffset, anchorPos,
}: {
  pivot: PivotInstance
  defaultLeft: number
  defaultTop: number
  onClose: () => void
  onMoveOffset: (offsetX: number, offsetY: number) => void
  anchorPos: { x: number; y: number }
}) {
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [slicerMenu, setSlicerMenu] = useState(false)
  const addSlicer = useSlicerStore((s) => s.addSlicer)
  const gridSheets = useSheetStore((s) => s.gridSheets)
  // Position is now controlled by parent (defaultLeft/defaultTop)
  const pos = { x: defaultLeft, y: defaultTop }

  function insertSlicer(colIndex: number, kind: 'list' | 'timeline') {
    const activeSheet = gridSheets.find((s) => s.status === 1) ?? gridSheets[0]
    if (!activeSheet) return
    const matrix = getRangeMatrix(activeSheet, pivot.sourceRange)
    const dataRows = pivot.hasHeader ? matrix.slice(1) : matrix
    const values = new Set<string>()
    for (const row of dataRows) {
      const v = row[colIndex]
      if (v !== null && v !== undefined && v !== '') values.add(String(v))
    }
    addSlicer({
      label: pivot.headerLabels[colIndex] ?? `Column ${colIndex + 1}`,
      kind,
      pivotId: pivot.id,
      columnIndex: colIndex,
      allValues: Array.from(values).sort(),
      selected: [],
      x: pos.x + size.w + 16,
      y: pos.y,
      width: 200,
      height: kind === 'timeline' ? 160 : 280,
    })
    setSlicerMenu(false)
  }

  const dragRef = useRef<{ startX: number; startY: number; baseOffX: number; baseOffY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | null>(null)

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseOffX: pivot.offsetX, baseOffY: pivot.offsetY }
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd, { once: true })
  }
  function onDragMove(e: MouseEvent) {
    if (!dragRef.current) return
    onMoveOffset(
      dragRef.current.baseOffX + (e.clientX - dragRef.current.startX),
      dragRef.current.baseOffY + (e.clientY - dragRef.current.startY),
    )
  }
  function onDragEnd() {
    dragRef.current = null
    document.removeEventListener('mousemove', onDragMove)
  }

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, baseW: size.w, baseH: size.h }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd, { once: true })
  }
  function onResizeMove(e: MouseEvent) {
    if (!resizeRef.current) return
    setSize({
      w: Math.max(360, resizeRef.current.baseW + (e.clientX - resizeRef.current.startX)),
      h: Math.max(200, resizeRef.current.baseH + (e.clientY - resizeRef.current.startY)),
    })
  }
  function onResizeEnd() {
    resizeRef.current = null
    document.removeEventListener('mousemove', onResizeMove)
  }

  useEffect(() => () => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mousemove', onResizeMove)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasCols = (pivot.config.columns?.length ?? 0) > 0
  const numValues = pivot.config.values.length
  const colKeys = pivot.result.columnKeys

  return (
    <div
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      className="absolute z-30 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move items-center justify-between border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100 px-2.5 py-1.5 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800/80"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <GripVertical className="h-3 w-3 shrink-0 text-zinc-400" />
          <TableIcon className="h-3 w-3 shrink-0 text-violet-500" />
          <span className="truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
            {pivot.name}
          </span>
          <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            {pivot.sourceRange}
          </span>
        </div>
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSlicerMenu((o) => !o)}
            title="Insert Slicer"
            className="rounded p-1 text-zinc-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Remove pivot"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* Slicer insert dropdown */}
          {slicerMenu && (
            <div className="absolute right-0 top-8 z-50 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Insert Slicer for…
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {pivot.headerLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertSlicer(i, 'list')}
                      className="flex flex-1 items-center gap-1.5 rounded px-2 py-1 text-[11px] text-zinc-700 hover:bg-blue-50 hover:text-blue-700 dark:text-zinc-200 dark:hover:bg-blue-900/30"
                    >
                      <Filter className="h-3 w-3 text-blue-500" />
                      {label || `Column ${i + 1}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertSlicer(i, 'timeline')}
                      title="Insert as Timeline"
                      className="rounded p-1 text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30"
                    >
                      <Calendar className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSlicerMenu(false)}
                className="mt-1 w-full rounded py-1 text-[10px] text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-auto" style={{ height: size.h - 32 }}>
        <table className="min-w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {hasCols && (
              <tr>
                {pivot.config.rows.map((c) => (
                  <th key={`r-h-${c}`} rowSpan={2} className="border-b border-zinc-200 px-3 py-1.5 text-left font-medium dark:border-zinc-700">
                    {pivot.headerLabels[c] ?? `Column ${c + 1}`}
                  </th>
                ))}
                {colKeys.map((ck, i) => (
                  <th key={`ck-${i}`} colSpan={numValues} className="border-b border-l border-zinc-200 px-3 py-1.5 text-center font-medium dark:border-zinc-700">
                    {ck.join(' / ')}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {!hasCols && pivot.config.rows.map((c) => (
                <th key={`r-h-${c}`} className="border-b border-zinc-200 px-3 py-1.5 text-left font-medium dark:border-zinc-700">
                  {pivot.headerLabels[c] ?? `Column ${c + 1}`}
                </th>
              ))}
              {hasCols
                ? colKeys.flatMap((_ck, ci) =>
                    pivot.config.values.map((v, vi) => (
                      <th key={`v-${ci}-${vi}`} className="border-b border-l border-zinc-200 px-3 py-1.5 text-right font-medium dark:border-zinc-700">
                        {v.label}
                      </th>
                    ))
                  )
                : pivot.config.values.map((v, vi) => (
                    <th key={`v-${vi}`} className="border-b border-l border-zinc-200 px-3 py-1.5 text-right font-medium dark:border-zinc-700">
                      {v.label}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {pivot.result.rows.map((row, i) => (
              <tr key={i} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                {row.keys.map((k, idx) => (
                  <td key={`k-${idx}`} className="border-b border-zinc-100 px-3 py-1 dark:border-zinc-800">
                    {k || <span className="text-zinc-400">(empty)</span>}
                  </td>
                ))}
                {row.valuesByCol.flatMap((colVals, ci) =>
                  colVals.map((v, vi) => (
                    <td key={`v-${ci}-${vi}`} className="border-b border-l border-zinc-100 px-3 py-1 text-right font-mono dark:border-zinc-800">
                      {Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        onMouseDown={onResizeStart}
        aria-label="Resize pivot"
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, rgb(161 161 170) 40%, rgb(161 161 170) 50%, transparent 50%, transparent 65%, rgb(161 161 170) 65%, rgb(161 161 170) 75%, transparent 75%)',
        }}
      />
    </div>
  )
}
