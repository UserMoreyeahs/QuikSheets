'use client'

import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnAnalysis } from '@/features/column-dna/utils/columnAnalyzer'

interface DistributionChartProps {
  analysis: ColumnAnalysis
}

function buildOption(analysis: ColumnAnalysis): EChartsOption {
  if (analysis.distribution.length === 0) {
    return {
      grid: { left: 0, right: 0, top: 8, bottom: 0 },
      xAxis: { show: false },
      yAxis: { show: false },
      series: [],
    }
  }

  if (analysis.dominantType === 'date') {
    return {
      animation: false,
      grid: { left: 8, right: 8, top: 10, bottom: 24 },
      tooltip: { trigger: 'item' },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 10, color: '#71717a' },
        axisLine: { lineStyle: { color: '#e4e4e7' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        show: false,
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 8,
          itemStyle: { color: '#2563eb' },
          data: analysis.distribution.map((item) => [item.timestamp, item.count]),
        },
      ],
    }
  }

  if (analysis.dominantType === 'text' || analysis.dominantType === 'boolean') {
    const rows = [...analysis.distribution].reverse()
    return {
      animation: false,
      grid: { left: 80, right: 8, top: 8, bottom: 12 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#71717a' },
        splitLine: { lineStyle: { color: '#f4f4f5' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((item) => item.label),
        axisLabel: { fontSize: 10, color: '#52525b', width: 72, overflow: 'truncate' },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((item) => item.count),
          itemStyle: { color: '#22c55e', borderRadius: [0, 3, 3, 0] },
          barWidth: 10,
        },
      ],
    }
  }

  return {
    animation: false,
    grid: { left: 24, right: 8, top: 8, bottom: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: analysis.distribution.map((item) => item.label),
      axisLabel: { fontSize: 9, color: '#71717a', rotate: 30 },
      axisLine: { lineStyle: { color: '#e4e4e7' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#71717a' },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    series: [
      {
        type: 'bar',
        data: analysis.distribution.map((item) => item.count),
        itemStyle: { color: '#2563eb', borderRadius: [3, 3, 0, 0] },
        barWidth: 14,
      },
    ],
  }
}

export function DistributionChart({ analysis }: DistributionChartProps) {
  return (
    <div className="h-[120px] w-full">
      <ReactECharts option={buildOption(analysis)} style={{ height: 120, width: '100%' }} />
    </div>
  )
}
