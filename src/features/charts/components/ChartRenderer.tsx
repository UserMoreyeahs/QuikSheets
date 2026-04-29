'use client'

import ReactECharts from 'echarts-for-react'
import type { ChartConfig } from '../types'
import { toEChartsOption, type RangeMatrix } from '../utils/toEChartsOption'

interface ChartRendererProps {
  matrix: RangeMatrix
  config: ChartConfig
  height?: number
}

export function ChartRenderer({ matrix, config, height = 320 }: ChartRendererProps) {
  const option = toEChartsOption(matrix, config)
  return <ReactECharts option={option} style={{ height, width: '100%' }} notMerge lazyUpdate />
}
