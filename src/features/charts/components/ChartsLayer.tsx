'use client'

/**
 * ChartsLayer — Excel-style embedded charts.
 *
 * Each inserted chart renders as an absolute-positioned panel *inside* the
 * grid container (so it visually sits on the sheet).  Charts can be:
 *   • dragged by the title bar
 *   • resized from the bottom-right corner (8x8 handle)
 *   • removed via the X button
 *   • their cell anchor (e.g. "C3") shows in the title bar — matches Excel's
 *     "anchored to cell" behaviour.
 *
 * The parent must be `position: relative` for absolute children to land in
 * the right place — the sheet page wraps SpreadsheetGrid in a relative
 * container exactly for this.
 *
 * PERFORMANCE: The outer `ChartsLayer` component only subscribes to the
 * chart list.  Heavy hooks (gridSheets, useGridScroll) are inside
 * `ChartsLayerInner` which only mounts when charts.length > 0.
 */

import { useEffect, useRef, useState } from 'react'
import { X, GripVertical, BarChart3 } from 'lucide-react'
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { useSheetStore } from '@/store/sheetStore'
import { ChartRenderer } from '@/features/charts/components/ChartRenderer'
import { getRangeMatrix } from '@/features/charts/utils/rangeUtils'
import { useGridScroll, cellToPixelPosition } from '@/features/grid/hooks/useGridScroll'
import type { Sheet } from '@fortune-sheet/core'

/** Default size used when a chart is first inserted. */
const DEFAULT_W = 480
const DEFAULT_H = 320

/**
 * Outer component — only subscribes to the chart list.
 * When empty, no heavy hooks mount at all.
 */
export function ChartsLayer() {
  const charts = useChartPanelStore((s) => s.charts)
  if (charts.length === 0) return null
  return <ChartsLayerInner />
}

/** Inner component — mounts heavy hooks only when charts exist. */
function ChartsLayerInner() {
  const charts = useChartPanelStore((s) => s.charts)
  const removeChart = useChartPanelStore((s) => s.removeChart)
  const moveChart = useChartPanelStore((s) => s.moveChart)
  const gridSheets = useSheetStore((s) => s.gridSheets)
  const scrollOffset = useGridScroll()

  return (
    <>
      {charts.map((chart) => {
        const sheet = gridSheets.find((s) => s.id === chart.sheetId) ?? gridSheets.find((s) => s.status === 1)
        // Compute scroll-anchored position
        const anchorPos = cellToPixelPosition(chart.anchorRow, chart.anchorCol, scrollOffset)
        return (
          <ChartFloatingPanel
            key={chart.id}
            id={chart.id}
            name={chart.name}
            anchor={chart.sourceRange}
            x={anchorPos.x + chart.x}
            y={anchorPos.y + chart.y}
            sheet={sheet}
            chart={chart}
            onClose={() => removeChart(chart.id)}
            onMove={(x, y) => {
              // Store offset relative to anchor cell
              moveChart(chart.id, x - anchorPos.x, y - anchorPos.y)
            }}
          />
        )
      })}
    </>
  )
}

interface PanelProps {
  id: string
  name: string
  anchor: string
  x: number
  y: number
  sheet: Sheet | undefined
  chart: ReturnType<typeof useChartPanelStore.getState>['charts'][number]
  onClose: () => void
  onMove: (x: number, y: number) => void
}

function ChartFloatingPanel({ id, name, anchor, x, y, sheet, chart, onClose, onMove }: PanelProps) {
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | null>(null)
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [, force] = useState(0)

  const matrix = sheet ? getRangeMatrix(sheet, chart.sourceRange) : []
  const hasData = matrix.some((row) => row.some((v) => v !== null && v !== ''))

  // ── drag ────────────────────────────────────────────────────────────
  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: x, baseY: y }
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd, { once: true })
  }
  function onDragMove(e: MouseEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const nextX = Math.max(0, dragRef.current.baseX + dx)
    const nextY = Math.max(0, dragRef.current.baseY + dy)
    onMove(nextX, nextY)
    force((n) => n + 1)
  }
  function onDragEnd() {
    dragRef.current = null
    document.removeEventListener('mousemove', onDragMove)
  }

  // ── resize (bottom-right corner) ─────────────────────────────────────
  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, baseW: size.w, baseH: size.h }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd, { once: true })
  }
  function onResizeMove(e: MouseEvent) {
    if (!resizeRef.current) return
    const dw = e.clientX - resizeRef.current.startX
    const dh = e.clientY - resizeRef.current.startY
    setSize({
      w: Math.max(280, resizeRef.current.baseW + dw),
      h: Math.max(180, resizeRef.current.baseH + dh),
    })
  }
  function onResizeEnd() {
    resizeRef.current = null
    document.removeEventListener('mousemove', onResizeMove)
  }

  // cleanup just in case
  useEffect(() => () => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mousemove', onResizeMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{ left: x, top: y, width: size.w }}
      className="absolute z-30 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-chart-id={id}
    >
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move items-center justify-between border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100 px-2.5 py-1.5 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800/80"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <GripVertical className="h-3 w-3 shrink-0 text-zinc-400" />
          <BarChart3 className="h-3 w-3 shrink-0 text-blue-500" />
          <span className="truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
            {name}
          </span>
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {anchor}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Remove chart"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="bg-white p-2 dark:bg-zinc-900" style={{ height: size.h - 32 }}>
        {hasData ? (
          <ChartRenderer matrix={matrix} config={chart.config} height={size.h - 48} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <BarChart3 className="mb-2 h-8 w-8 text-zinc-300" />
            <div className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">
              No data in <code className="font-mono text-[11px]">{chart.sourceRange}</code>
            </div>
            <div className="mt-1 text-[11px] text-zinc-400">
              Type values into those cells, then the chart will update automatically.
            </div>
          </div>
        )}
      </div>
      {/* resize handle */}
      <div
        onMouseDown={onResizeStart}
        aria-label="Resize chart"
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, rgb(161 161 170) 40%, rgb(161 161 170) 50%, transparent 50%, transparent 65%, rgb(161 161 170) 65%, rgb(161 161 170) 75%, transparent 75%)',
        }}
      />
    </div>
  )
}
