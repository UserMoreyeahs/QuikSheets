'use client'

import { AlertTriangle, CircleMinus, ListChecks } from 'lucide-react'
import type { ColumnAnalysis } from '@/features/column-dna/utils/columnAnalyzer'

interface AnomalySectionProps {
  analysis: ColumnAnalysis
  columnLabel: string
  onHighlightOutliers?: (indexes: number[]) => void
}

function rowList(indexes: number[]): string {
  return indexes
    .slice(0, 8)
    .map((index) => index + 2)
    .join(', ')
}

export function AnomalySection({
  analysis,
  columnLabel,
  onHighlightOutliers,
}: AnomalySectionProps) {
  const hasAnomalies =
    analysis.outliers.length > 0 ||
    analysis.negativeIndexes.length > 0 ||
    analysis.mixedTypeIndexes.length > 0

  if (!hasAnomalies) {
    return <div className="text-sm text-zinc-500">No anomalies detected</div>
  }

  return (
    <div className="space-y-2">
      {analysis.outliers.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-amber-900">
                {analysis.outliers.length} outlier value{analysis.outliers.length === 1 ? '' : 's'} detected
              </div>
              <div className="mt-0.5 text-xs text-amber-800">Rows {rowList(analysis.outliers)}</div>
            </div>
            <button
              type="button"
              onClick={() => onHighlightOutliers?.(analysis.outliers)}
              className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              Highlight
            </button>
          </div>
        </div>
      )}

      {analysis.negativeIndexes.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <div className="flex items-start gap-2">
            <CircleMinus className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <div className="text-sm font-medium text-red-900">
                {analysis.negativeIndexes.length} negative value
                {analysis.negativeIndexes.length === 1 ? '' : 's'} in {columnLabel} column
              </div>
              <div className="mt-0.5 text-xs text-red-700">Rows {rowList(analysis.negativeIndexes)}</div>
            </div>
          </div>
        </div>
      )}

      {analysis.mixedTypeIndexes.length > 0 && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
          <div className="flex items-start gap-2">
            <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
            <div>
              <div className="text-sm font-medium text-orange-900">
                Mixed type warning
              </div>
              <div className="mt-0.5 text-xs text-orange-700">
                Rows {rowList(analysis.mixedTypeIndexes)} do not match the dominant {analysis.dominantType} type
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
