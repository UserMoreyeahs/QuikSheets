'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import type { ChartConfig } from '../types'
import { toEChartsOption, type RangeMatrix } from '../utils/toEChartsOption'

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
  useEffect(() => {
    instanceRef.current?.setOption(option, { notMerge: true, lazyUpdate: true })
  }, [option])

  // Resize when the parent's height prop changes.
  useEffect(() => {
    instanceRef.current?.resize()
  }, [height])

  return <div ref={containerRef} style={{ height, width: '100%' }} />
}
