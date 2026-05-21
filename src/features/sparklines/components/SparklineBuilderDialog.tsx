'use client'

/**
 * SparklineBuilderDialog
 * --------------------------------------------------------------------------
 * Insert > Sparklines > Line / Column / Win-Loss opens this dialog with
 * the kind pre-selected. User picks a source range and a target cell, we
 * register the sparkline and SparklinesLayer renders it.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Activity, BarChart3, LineChart } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSparklineBuilderStore, useSparklineStore, type SparklineKind } from '../store/sparklineStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { colIndexToLetter } from '@/lib/cellAddress'
import { parseA1Range } from '@/features/charts/utils/rangeUtils'

const KIND_LABELS: Record<SparklineKind, { label: string; icon: React.ReactNode }> = {
  line:     { label: 'Line',     icon: <LineChart className="h-3.5 w-3.5" /> },
  column:   { label: 'Column',   icon: <BarChart3 className="h-3.5 w-3.5" /> },
  win_loss: { label: 'Win/Loss', icon: <Activity  className="h-3.5 w-3.5" /> },
}

function defaultRangeForSelection(state: ReturnType<typeof useSheetStore.getState>): string {
  const r = state.selectedRange
  if (r) {
    const sr = Math.min(r.start.row, r.end.row) + 1
    const er = Math.max(r.start.row, r.end.row) + 1
    const sc = colIndexToLetter(Math.min(r.start.col, r.end.col))
    const ec = colIndexToLetter(Math.max(r.start.col, r.end.col))
    return `${sc}${sr}:${ec}${er}`
  }
  const c = state.selectedCell
  if (c) {
    const letter = colIndexToLetter(c.col)
    return `${letter}${c.row + 1}`
  }
  return 'B2:F2'
}

function defaultTargetForSelection(state: ReturnType<typeof useSheetStore.getState>): string {
  // Suggest the cell immediately to the right of the source range.
  const r = state.selectedRange
  if (r) {
    const er = Math.max(r.start.row, r.end.row) + 1
    const ec = Math.max(r.start.col, r.end.col) + 1
    return `${colIndexToLetter(ec)}${er}`
  }
  return 'G2'
}

export function SparklineBuilderDialog() {
  const open = useSparklineBuilderStore((s) => s.open)
  const initialKind = useSparklineBuilderStore((s) => s.initialKind)
  const closeBuilder = useSparklineBuilderStore((s) => s.closeBuilder)
  const add = useSparklineStore((s) => s.add)
  const activeSheetId = useWorkbookStore((s) => s.activeSheetId)

  const [kind, setKind] = useState<SparklineKind>('line')
  const [sourceRange, setSourceRange] = useState('')
  const [targetCell, setTargetCell] = useState('')

  useEffect(() => {
    if (!open) return
    setKind(initialKind)
    const state = useSheetStore.getState()
    setSourceRange(defaultRangeForSelection(state))
    setTargetCell(defaultTargetForSelection(state))
  }, [open, initialKind])

  function handleInsert(): void {
    if (!activeSheetId) {
      toast.error('No active sheet.')
      return
    }
    if (!parseA1Range(sourceRange.trim().toUpperCase())) {
      toast.error('Enter a valid source range like B2:F2.')
      return
    }
    const target = parseA1Range(targetCell.trim().toUpperCase())
    if (!target) {
      toast.error('Enter a valid target cell like G2.')
      return
    }
    add({
      sheetId: activeSheetId,
      sourceRange: sourceRange.trim().toUpperCase(),
      targetRow: target.rowStart,
      targetCol: target.colStart,
      kind,
    })
    toast.success(`${KIND_LABELS[kind].label} sparkline added at ${targetCell.trim().toUpperCase()}`)
    closeBuilder()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeBuilder() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Sparkline</DialogTitle>
          <DialogDescription>
            A sparkline is a tiny in-cell chart showing the trend of a range
            of values. Excel-equivalent: Insert &gt; Sparklines.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kind</div>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(KIND_LABELS) as SparklineKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={
                    'flex items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[12px] ' +
                    (kind === k
                      ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800')
                  }
                >
                  {KIND_LABELS[k].icon}
                  {KIND_LABELS[k].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="sl-src" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Data range
            </label>
            <input
              id="sl-src"
              type="text"
              value={sourceRange}
              onChange={(e) => setSourceRange(e.target.value)}
              placeholder="e.g. B2:F2"
              className="h-9 w-full rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="sl-tgt" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Target cell
            </label>
            <input
              id="sl-tgt"
              type="text"
              value={targetCell}
              onChange={(e) => setTargetCell(e.target.value)}
              placeholder="e.g. G2"
              className="h-9 w-full rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeBuilder}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Insert sparkline
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
