'use client'

/**
 * DashboardCanvas — read/edit render of a Dashboard.
 *
 * Renders all widgets in a 12-column CSS grid.  Each widget occupies the
 * slot defined by its layout.{x, y, w, h}.  The canvas supports free-form
 * drag + resize when `editable` is true.
 *
 * KPI    → big-number card with optional delta arrow
 * Chart  → dynamic-imported ChartRenderer
 * Text   → lightweight markdown renderer (no external lib needed)
 * Table  → plain data table from a range
 *
 * Drag/resize is implemented without react-grid-layout (not in package.json).
 * We track pointer events directly on each widget handle.
 */

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef, useState } from 'react'
import { GripVertical, Pencil, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import {
  computeAggregate,
  computeDeltaPercent,
  formatKpiValue,
  type Dashboard,
  type KpiWidget,
  type ChartWidget,
  type TextWidget,
  type TableWidget,
  type Widget,
} from '../types'
import { extractNumericValues, extractRangeMatrix } from '../utils/rangeValues'
import { useDashboardStore } from '../store/dashboardStore'
import { WidgetEditDialog } from './WidgetEditDialog'
import type { ChartConfig } from '@/features/charts/types'

// ChartRenderer dynamically imported to avoid SSR issues (echarts uses window).
const ChartRenderer = dynamic(
  () =>
    import('@/features/charts/components/ChartRenderer').then(
      (m) => m.ChartRenderer
    ),
  { ssr: false }
)

// ---------------------------------------------------------------------------
// Row-unit height in pixels
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 80
const COL_COUNT = 12

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DashboardCanvasProps {
  dashboard: Dashboard
  editable?: boolean
}

export function DashboardCanvas({
  dashboard,
  editable = false,
}: DashboardCanvasProps) {
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const updateWidget = useDashboardStore((s) => s.updateWidget)
  const removeWidget = useDashboardStore((s) => s.removeWidget)
  const setLayout = useDashboardStore((s) => s.setLayout)

  const { gridSheets } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const activeSheet = useMemo(
    () => gridSheets.find((s) => s.id === activeSheetId) ?? gridSheets[0],
    [gridSheets, activeSheetId]
  )

  // Canvas ref for measuring column width during drag
  const canvasRef = useRef<HTMLDivElement | null>(null)

  // Drag state
  const dragRef = useRef<{
    widgetId: string
    startX: number
    startY: number
    origLayout: Widget['layout']
  } | null>(null)

  // Resize state
  const resizeRef = useRef<{
    widgetId: string
    startX: number
    startY: number
    origLayout: Widget['layout']
  } | null>(null)

  const colWidth = useCallback(() => {
    if (!canvasRef.current) return 80
    return canvasRef.current.getBoundingClientRect().width / COL_COUNT
  }, [])

  // ── Pointer handlers for drag ─────────────────────────────────────────────

  function onDragStart(e: React.PointerEvent, widget: Widget) {
    if (!editable) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      widgetId: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      origLayout: { ...widget.layout },
    }
  }

  function onDragMove(e: React.PointerEvent, widget: Widget) {
    if (!dragRef.current || dragRef.current.widgetId !== widget.id) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const cw = colWidth()
    const colDelta = Math.round(dx / cw)
    const rowDelta = Math.round(dy / ROW_HEIGHT)
    const orig = dragRef.current.origLayout
    const newX = Math.max(0, Math.min(COL_COUNT - orig.w, orig.x + colDelta))
    const newY = Math.max(0, orig.y + rowDelta)
    if (newX !== widget.layout.x || newY !== widget.layout.y) {
      setLayout(dashboard.id, widget.id, { ...widget.layout, x: newX, y: newY })
    }
  }

  function onDragEnd() {
    dragRef.current = null
  }

  // ── Pointer handlers for resize ───────────────────────────────────────────

  function onResizeStart(e: React.PointerEvent, widget: Widget) {
    if (!editable) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeRef.current = {
      widgetId: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      origLayout: { ...widget.layout },
    }
  }

  function onResizeMove(e: React.PointerEvent, widget: Widget) {
    if (!resizeRef.current || resizeRef.current.widgetId !== widget.id) return
    const dx = e.clientX - resizeRef.current.startX
    const dy = e.clientY - resizeRef.current.startY
    const cw = colWidth()
    const colDelta = Math.round(dx / cw)
    const rowDelta = Math.round(dy / ROW_HEIGHT)
    const orig = resizeRef.current.origLayout
    const newW = Math.max(1, Math.min(COL_COUNT - orig.x, orig.w + colDelta))
    const newH = Math.max(1, orig.h + rowDelta)
    if (newW !== widget.layout.w || newH !== widget.layout.h) {
      setLayout(dashboard.id, widget.id, { ...widget.layout, w: newW, h: newH })
    }
  }

  function onResizeEnd() {
    resizeRef.current = null
  }

  // ── Canvas height ─────────────────────────────────────────────────────────

  const canvasHeight = useMemo(() => {
    const maxRow = dashboard.widgets.reduce(
      (acc, w) => Math.max(acc, w.layout.y + w.layout.h),
      4
    )
    return (maxRow + 1) * ROW_HEIGHT
  }, [dashboard.widgets])

  return (
    <>
      <div
        ref={canvasRef}
        className="relative w-full"
        style={{ height: canvasHeight }}
      >
        {dashboard.widgets.map((widget) => {
          const { x, y, w, h } = widget.layout
          const colPct = 100 / COL_COUNT
          return (
            <div
              key={widget.id}
              className={cn(
                'absolute overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900',
                editable &&
                  'cursor-grab transition-shadow hover:shadow-md active:cursor-grabbing'
              )}
              style={{
                left: `${x * colPct}%`,
                top: y * ROW_HEIGHT,
                width: `${w * colPct}%`,
                height: h * ROW_HEIGHT,
              }}
              onPointerDown={(e) => onDragStart(e, widget)}
              onPointerMove={(e) => {
                onDragMove(e, widget)
                onResizeMove(e, widget)
              }}
              onPointerUp={() => {
                onDragEnd()
                onResizeEnd()
              }}
            >
              {/* Drag handle (editable only) */}
              {editable && (
                <div className="absolute left-1 top-1 z-10 flex gap-1">
                  <span className="cursor-grab text-zinc-300 hover:text-zinc-500 dark:text-zinc-600">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                </div>
              )}

              {/* Edit + delete controls (editable only) */}
              {editable && (
                <div className="absolute right-1 top-1 z-10 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingWidget(widget)}
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="Edit widget"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWidget(dashboard.id, widget.id)}
                    className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                    aria-label="Remove widget"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Widget content */}
              <div className="h-full w-full overflow-hidden p-2">
                {widget.kind === 'kpi' && activeSheet && (
                  <KpiWidgetView widget={widget} sheet={activeSheet} />
                )}
                {widget.kind === 'chart' && activeSheet && (
                  <ChartWidgetView
                    widget={widget}
                    gridSheets={gridSheets}
                    activeSheetId={activeSheetId}
                    containerHeight={(h * ROW_HEIGHT) - 24}
                  />
                )}
                {widget.kind === 'text' && (
                  <TextWidgetView widget={widget} />
                )}
                {widget.kind === 'table' && activeSheet && (
                  <TableWidgetView widget={widget} sheet={activeSheet} />
                )}
              </div>

              {/* Resize handle (editable only) */}
              {editable && (
                <div
                  className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                  onPointerDown={(e) => onResizeStart(e, widget)}
                >
                  <svg
                    viewBox="0 0 8 8"
                    className="absolute bottom-0.5 right-0.5 h-3 w-3 text-zinc-300 dark:text-zinc-600"
                  >
                    <path d="M7 1L1 7M7 5L5 7M3 7L7 3" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Widget edit dialog */}
      {editingWidget && (
        <WidgetEditDialog
          widget={editingWidget}
          onSave={(updates) => {
            updateWidget(dashboard.id, editingWidget.id, updates)
            setEditingWidget(null)
          }}
          onClose={() => setEditingWidget(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// KPI widget view
// ---------------------------------------------------------------------------

function KpiWidgetView({
  widget,
  sheet,
}: {
  widget: KpiWidget
  sheet: import('@fortune-sheet/core').Sheet
}) {
  const values = useMemo(
    () => extractNumericValues(sheet, widget.range),
    [sheet, widget.range]
  )
  const currentValue = computeAggregate(values, widget.aggregate)

  const deltaValues = useMemo(() => {
    if (!widget.delta?.range) return null
    return extractNumericValues(sheet, widget.delta.range)
  }, [sheet, widget.delta])

  const previousValue = deltaValues
    ? computeAggregate(deltaValues, widget.aggregate)
    : null

  const deltaPercent =
    previousValue !== null ? computeDeltaPercent(currentValue, previousValue) : null

  const isPositive = deltaPercent !== null && deltaPercent >= 0

  return (
    <div className="flex h-full flex-col justify-between">
      {/* Title */}
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
        {widget.title}
      </div>

      {/* Big number */}
      <div className="flex-1 flex items-center">
        <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50 leading-none truncate">
          {formatKpiValue(currentValue, widget.format)}
        </span>
      </div>

      {/* Delta row */}
      {deltaPercent !== null && (
        <div
          className={cn(
            'flex items-center gap-1 text-[12px] font-medium',
            isPositive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {isPositive ? '+' : ''}
            {(deltaPercent * 100).toFixed(1)}% {widget.delta?.label ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart widget view
// ---------------------------------------------------------------------------

function ChartWidgetView({
  widget,
  gridSheets,
  activeSheetId,
  containerHeight,
}: {
  widget: ChartWidget
  gridSheets: import('@fortune-sheet/core').Sheet[]
  activeSheetId: string
  containerHeight: number
}) {
  const sheet = useMemo(() => {
    const targetId = widget.sheetId || activeSheetId
    return gridSheets.find((s) => s.id === targetId) ?? gridSheets[0]
  }, [gridSheets, widget.sheetId, activeSheetId])

  const matrix = useMemo(
    () => (sheet ? extractRangeMatrix(sheet, widget.range) : []),
    [sheet, widget.range]
  )

  const chartConfig: ChartConfig = useMemo(
    () => ({
      kind: widget.chartType,
      title: widget.title,
      hasHeader: widget.hasHeader,
      categoryColumn: widget.categoryColumn,
      seriesColumns:
        widget.seriesColumns.length > 0 ? widget.seriesColumns : [1],
      legend: true,
    }),
    [widget]
  )

  if (matrix.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-zinc-400">
        No data in range {widget.range}
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      {widget.title && (
        <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 truncate">
          {widget.title}
        </div>
      )}
      <ChartRenderer
        matrix={matrix as import('@/features/charts/utils/toEChartsOption').RangeMatrix}
        config={chartConfig}
        height={containerHeight - (widget.title ? 20 : 0)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text widget view — minimal markdown renderer
// ---------------------------------------------------------------------------

function renderMarkdown(content: string): string {
  return content
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-2 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-2 mb-1">$1</h1>')
    // Bold / italic / code
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 rounded px-0.5">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br />')
}

function TextWidgetView({ widget }: { widget: TextWidget }) {
  const html = useMemo(() => renderMarkdown(widget.content), [widget.content])
  return (
    <div
      className="h-full w-full overflow-auto text-[12px] text-zinc-700 dark:text-zinc-300 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ---------------------------------------------------------------------------
// Table widget view
// ---------------------------------------------------------------------------

function TableWidgetView({
  widget,
  sheet,
}: {
  widget: TableWidget
  sheet: import('@fortune-sheet/core').Sheet
}) {
  const matrix = useMemo(
    () => extractRangeMatrix(sheet, widget.range),
    [sheet, widget.range]
  )

  if (matrix.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-zinc-400">
        No data in range {widget.range}
      </div>
    )
  }

  const header = widget.hasHeader ? matrix[0] : null
  const rows = widget.hasHeader ? matrix.slice(1) : matrix
  const cap = widget.maxRows ?? 10
  const visibleRows = rows.slice(0, cap)

  return (
    <div className="h-full w-full overflow-auto">
      {widget.title && (
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
          {widget.title}
        </div>
      )}
      <table className="w-full border-collapse text-[11px]">
        {header && (
          <thead>
            <tr>
              {header.map((cell, ci) => (
                <th
                  key={ci}
                  className="border-b border-zinc-200 bg-zinc-50 px-2 py-1 text-left font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {cell ?? ''}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {visibleRows.map((row, ri) => (
            <tr
              key={ri}
              className="odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-b border-zinc-100 px-2 py-0.5 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 truncate max-w-[120px]"
                >
                  {cell ?? ''}
                </td>
              ))}
            </tr>
          ))}
          {rows.length > cap && (
            <tr>
              <td
                colSpan={header ? header.length : (visibleRows[0]?.length ?? 1)}
                className="px-2 py-1 text-[10px] text-zinc-400 dark:text-zinc-500"
              >
                + {rows.length - cap} more rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
