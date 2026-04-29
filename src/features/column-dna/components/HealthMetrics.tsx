'use client'

import type { ColumnAnalysis } from '@/features/column-dna/utils/columnAnalyzer'

interface HealthMetricsProps {
  analysis: ColumnAnalysis
}

interface Metric {
  label: string
  value: string | number
  tone?: 'green' | 'orange'
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function HealthMetrics({ analysis }: HealthMetricsProps) {
  const metrics: Metric[] = [
    { label: 'Total cells', value: analysis.totalCells },
    {
      label: 'Filled',
      value: analysis.filledCells,
      ...(analysis.totalCells > 0 && analysis.filledCells / analysis.totalCells > 0.95
        ? { tone: 'green' as const }
        : {}),
    },
    {
      label: `Empty (${formatPercent(analysis.emptyPercent)})`,
      value: analysis.emptyCells,
      ...(analysis.emptyPercent > 5 ? { tone: 'orange' as const } : {}),
    },
    { label: 'Unique values', value: analysis.uniqueValues },
    { label: 'Duplicates', value: analysis.duplicateValues },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={[
            'rounded-md border px-3 py-2',
            metric.tone === 'green'
              ? 'border-green-200 bg-green-50'
              : metric.tone === 'orange'
                ? 'border-orange-200 bg-orange-50'
                : 'border-zinc-200 bg-white',
          ].join(' ')}
        >
          <div className="text-lg font-semibold leading-6 text-zinc-900">{metric.value}</div>
          <div className="mt-0.5 text-[11px] font-medium text-zinc-500">{metric.label}</div>
        </div>
      ))}
    </div>
  )
}
