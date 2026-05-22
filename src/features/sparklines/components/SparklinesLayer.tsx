'use client'

/**
 * SparklinesLayer
 * --------------------------------------------------------------------------
 * Renders tiny ECharts mini-charts at each sparkline's target cell. Excel
 * draws sparklines INSIDE the cell; we render an absolute-positioned chart
 * over the cell that scrolls with the grid.
 *
 * The container subscribes to grid scroll via useGridScroll so the chart
 * tracks the cell. Each sparkline mounts a small ECharts instance via the
 * shared registration in @/features/charts/components/ChartRenderer.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { X } from 'lucide-react'
import { useSparklineStore, type InsertedSparkline, type SparklineKind } from '../store/sparklineStore'
import { useSheetStore } from '@/store/sheetStore'
import { useGridScroll, cellToPixelPosition } from '@/features/grid/hooks/useGridScroll'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { parseA1Range } from '@/features/charts/utils/rangeUtils'

// Match the cell dimensions that cellToPixelPosition uses internally —
// FortuneSheet renders cells at 73x20 even though DEFAULT_CELL_WIDTH/HEIGHT
// in our constants are 100x24. Using the position-math constants keeps
// the sparkline glued to the actual visual cell rect.
const SPARK_CELL_W = 73
const SPARK_CELL_H = 20

echarts.use([LineChart, BarChart, CustomChart, GridComponent, TooltipComponent, SVGRenderer])

export function SparklinesLayer() {
  const sparklines = useSparklineStore((s) => s.sparklines)
  if (sparklines.length === 0) return null
  return <SparklinesLayerInner />
}

function SparklinesLayerInner() {
  const sparklines = useSparklineStore((s) => s.sparklines)
  const remove = useSparklineStore((s) => s.remove)
  const gridSheets = useSheetStore((s) => s.gridSheets)
  const scrollOffset = useGridScroll()

  return (
    <>
      {sparklines.map((sp) => {
        const sheet = gridSheets.find((s) => s.id === sp.sheetId) ?? gridSheets.find((s) => s.status === 1)
        if (!sheet) return null
        const pos = cellToPixelPosition(sp.targetRow, sp.targetCol, scrollOffset)
        return (
          <SparklineCell
            key={sp.id}
            sparkline={sp}
            x={pos.x}
            y={pos.y}
            values={readSourceValues(sheet, sp.sourceRange)}
            onRemove={() => remove(sp.id)}
          />
        )
      })}
    </>
  )
}

function readSourceValues(sheet: ReturnType<typeof useSheetStore.getState>['gridSheets'][number], range: string): number[] {
  const bounds = parseA1Range(range)
  if (!bounds) return []
  const matrix = getSheetMatrix(sheet)
  const out: number[] = []
  for (let r = bounds.rowStart; r <= bounds.rowEnd; r++) {
    for (let c = bounds.colStart; c <= bounds.colEnd; c++) {
      const v = getCellDisplayValue(matrix[r]?.[c] ?? null)
      if (v === null || v === '') continue
      const n = Number(v)
      if (!isNaN(n)) out.push(n)
    }
  }
  return out
}

interface SparklineCellProps {
  sparkline: InsertedSparkline
  x: number
  y: number
  values: number[]
  onRemove: () => void
}

function SparklineCell({ sparkline, x, y, values, onRemove }: SparklineCellProps) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const [hovered, setHovered] = useState(false)

  // Init the mini chart on first render. SPARK_CELL_W/H match the cell
  // dimensions that cellToPixelPosition uses internally (73x20) so the
  // sparkline stays inside the actual visual cell rect.
  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current, undefined, { renderer: 'svg' })
    return () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [])

  const option = useMemo(
    () => buildOption(sparkline.kind, values, sparkline.color),
    [sparkline.kind, sparkline.color, values],
  )

  useEffect(() => {
    instanceRef.current?.setOption(option, { notMerge: true })
  }, [option])

  // Wrapper has pointerEvents:auto so we can detect hover for the × button.
  // The chart itself sets pointerEvents:none so cell-selection still works
  // when the user clicks inside the sparkline area. Only the × button
  // captures clicks.
  return (
    <div
      data-sparkline-id={sparkline.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: x + 1,
        top: y + 1,
        width: SPARK_CELL_W - 2,
        height: SPARK_CELL_H - 2,
        zIndex: 15,
        pointerEvents: 'auto',
      }}
      title={`${sparkline.kind} sparkline from ${sparkline.sourceRange} — hover to remove`}
    >
      <div
        ref={chartRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />
      {hovered && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Remove sparkline"
          title="Remove sparkline"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 14,
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#ef4444',
            color: 'white',
            border: '1px solid white',
            cursor: 'pointer',
            padding: 0,
            zIndex: 16,
          }}
        >
          <X size={9} />
        </button>
      )}
    </div>
  )
}

/** Build the ECharts option for a tiny in-cell chart — no axes, no tooltips. */
function buildOption(kind: SparklineKind, values: number[], color?: string): Record<string, unknown> {
  const grid = { top: 1, bottom: 1, left: 1, right: 1, containLabel: false }
  const xAxis = { type: 'category', show: false, boundaryGap: kind === 'column' || kind === 'win_loss' }
  const yAxis = { type: 'value', show: false }

  if (kind === 'line') {
    return {
      grid, xAxis, yAxis,
      animation: false,
      series: [
        {
          type: 'line',
          data: values,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: color ?? '#2563eb' },
        },
      ],
    }
  }

  if (kind === 'column') {
    return {
      grid, xAxis, yAxis,
      animation: false,
      series: [
        {
          type: 'bar',
          data: values,
          itemStyle: { color: color ?? '#2563eb' },
          barCategoryGap: '20%',
        },
      ],
    }
  }

  // win_loss: +1 above the axis, -1 below, zeros suppressed
  const data = values.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0))
  return {
    grid, xAxis, yAxis: { type: 'value', show: false, min: -1, max: 1 },
    animation: false,
    series: [
      {
        type: 'bar',
        data,
        itemStyle: {
          color: (params: { value: number }) => (params.value >= 0 ? '#16a34a' : '#dc2626'),
        },
        barCategoryGap: '20%',
      },
    ],
  }
}
