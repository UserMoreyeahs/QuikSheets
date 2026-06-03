'use client'

import { Sparkles } from 'lucide-react'
import type { RowSummarySelection } from '@/features/row-summarizer'

export interface SelectedRowRangeState extends RowSummarySelection {
  left: number
  top: number
  rowCount: number
}

interface SelectedRowsFloaterProps {
  selectedRowRange: SelectedRowRangeState
  onSummarizeRows: (selection: RowSummarySelection) => void
}

export function SelectedRowsFloater({ selectedRowRange, onSummarizeRows }: SelectedRowsFloaterProps) {
  return (
    <div
      style={{ left: selectedRowRange.left, top: selectedRowRange.top }}
      className="absolute z-[86] flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-blue-900/70 dark:bg-zinc-800"
    >
      <span className="font-medium text-zinc-700 dark:text-zinc-200">
        {selectedRowRange.rowCount} rows selected
      </span>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSummarizeRows(selectedRowRange)}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 font-semibold text-white transition-colors hover:bg-blue-700"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Summarize rows
      </button>
    </div>
  )
}
