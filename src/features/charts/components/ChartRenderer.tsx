'use client'

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { ChartConfig } from '../types'
import { toEChartsOption, type RangeMatrix } from '../utils/toEChartsOption'

interface ChartRendererProps {
  matrix: RangeMatrix
  config: ChartConfig
  height?: number
}

export function ChartRenderer({ matrix, config, height = 320 }: ChartRendererProps) {
  // ECharts 6 logs "setOption should not be called during main process" when
  // it receives a fresh option object on every render. Memoize so the
  // reference is stable across rerenders that don't change data/config.
  const option = useMemo(() => toEChartsOption(matrix, config), [matrix, config])
  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge
      lazyUpdate
      opts={{ renderer: 'svg' }}
    />
  )
}
