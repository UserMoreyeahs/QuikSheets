'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  GaugeChart,
  FunnelChart,
  HeatmapChart,
  TreemapChart,
  CustomChart,
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { ChartConfig } from '../types'
import { toEChartsOption, type RangeMatrix } from '../utils/toEChartsOption'

// Register all chart kinds + components Quiksheets uses. ECharts 6 uses
// tree-shakable imports — without these explicit `use` calls we get
// "Unknown series [object Object]" at runtime.
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, RadarChart,
  GaugeChart, FunnelChart, HeatmapChart, TreemapChart, CustomChart,
  GridComponent, TooltipComponent, TitleComponent, LegendComponent,
  DataZoomComponent, MarkLineComponent, MarkPointComponent,
  SVGRenderer,
])

interface ChartRendererProps {
  matrix: RangeMatrix
  config: ChartConfig
  height?: number
}

/**
 * Thin direct-echarts wrapper.
 *
 * Replaces echarts-for-react because v3.0.6 + ECharts 6 trips the
 * "setOption should not be called during main process" guard, which
 * silently aborts the first paint. We own init/setOption/resize/dispose
 * via refs so the lifecycle is predictable.
 */
export function ChartRenderer({ matrix, config, height = 320 }: ChartRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const option = useMemo(() => toEChartsOption(matrix, config), [matrix, config])

  // Init once when the container mounts.
  useEffect(() => {
    if (!containerRef.current) return
    instanceRef.current = echarts.init(containerRef.current, undefined, { renderer: 'svg' })
    const onResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [])

  // Push option whenever data or config changes — outside any echarts
  // main process, so no "setOption during main process" warning.
  //
  // We hand ECharts a JSON-roundtripped option to strip any non-cloneable
  // garnish (functions, Proxies, circular refs) that Zustand selectors or
  // React DevTools may sneak in. ECharts 6's zrender clone otherwise hits
  // infinite recursion on certain proxied inputs.
  useEffect(() => {
    if (!instanceRef.current) return
    // Strip any DOM nodes / React fiber refs / functions that may have
    // slipped into the option (Zustand selectors that returned mid-fiber
    // objects, for example) — they cause zrender's clone to recurse
    // through React internals forever.
    const sanitized = stripNonSerializable(option) as Record<string, unknown>
    // eslint-disable-next-line no-console
    console.log('[ChartRenderer] sanitized option:', JSON.stringify(sanitized).slice(0, 600))
    instanceRef.current.setOption(sanitized as Parameters<echarts.ECharts['setOption']>[0], {
      notMerge: true,
      lazyUpdate: true,
    })
  }, [option])

  // Resize when the parent's height prop changes.
  useEffect(() => {
    instanceRef.current?.resize()
  }, [height])

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}

/**
 * Deep-strip values that ECharts' zrender clone cannot handle:
 * DOM nodes, React fibers, functions, and anything with a circular ref.
 * Returns a plain JSON-compatible object.
 */
function stripNonSerializable(input: unknown, seen = new WeakSet<object>()): unknown {
  if (input === null || input === undefined) return input
  const t = typeof input
  if (t === 'string' || t === 'number' || t === 'boolean') return input
  if (t === 'function') return undefined
  if (t !== 'object') return undefined
  if (typeof window !== 'undefined' && input instanceof Node) return undefined
  if (seen.has(input as object)) return undefined
  seen.add(input as object)
  if (Array.isArray(input)) {
    return input.map((v) => stripNonSerializable(v, seen))
  }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (key.startsWith('__react')) continue
    if (key === 'stateNode' || key === 'fiber' || key === '_owner') continue
    out[key] = stripNonSerializable((input as Record<string, unknown>)[key], seen)
  }
  return out
}
