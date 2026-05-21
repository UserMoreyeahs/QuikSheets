'use client'

/**
 * SlicerBuilderDialog
 * --------------------------------------------------------------------------
 * The UI front door for Insert > Slicer. Without this, the slicer store +
 * SlicersLayer + filter integration were all in place but unreachable from
 * the ribbon.
 *
 * Flow:
 *   1. Open the dialog (from Insert > Slicer)
 *   2. Pick which pivot to attach to (from the list of existing pivots)
 *   3. Pick which column of that pivot's source data to filter by
 *   4. Confirm — we compute the distinct values for that column from the
 *      source sheet, then call slicerStore.addSlicer with the right shape.
 *
 * Users still need an existing PivotTable for slicers to attach to —
 * matches Excel, where Insert > Slicer is grey-disabled until a pivot
 * exists on the sheet.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Filter } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSlicerBuilderStore } from '../store/slicerBuilderStore'
import { useSlicerStore } from '../store/slicerStore'
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import { useSheetStore } from '@/store/sheetStore'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { parseA1Range } from '@/features/charts/utils/rangeUtils'

export function SlicerBuilderDialog() {
  const open = useSlicerBuilderStore((s) => s.open)
  const closeBuilder = useSlicerBuilderStore((s) => s.closeBuilder)
  const pivots = usePivotUiStore((s) => s.pivots)
  const addSlicer = useSlicerStore((s) => s.addSlicer)
  const gridSheets = useSheetStore((s) => s.gridSheets)

  const [selectedPivotId, setSelectedPivotId] = useState<string | null>(null)
  const [selectedColIdx, setSelectedColIdx] = useState<number>(0)

  // Default to the first pivot when the dialog opens.
  useEffect(() => {
    if (!open) return
    if (pivots.length > 0 && (selectedPivotId === null || !pivots.find((p) => p.id === selectedPivotId))) {
      setSelectedPivotId(pivots[0]?.id ?? null)
      setSelectedColIdx(0)
    }
  }, [open, pivots, selectedPivotId])

  const pivot = useMemo(
    () => pivots.find((p) => p.id === selectedPivotId) ?? null,
    [pivots, selectedPivotId],
  )

  // Distinct values for the column the user picked — what'll show in the slicer.
  const distinctValues = useMemo<string[]>(() => {
    if (!pivot) return []
    const activeSheet = gridSheets.find((s) => s.status === 1) ?? gridSheets[0]
    if (!activeSheet) return []
    const bounds = parseA1Range(pivot.sourceRange)
    if (!bounds) return []
    const matrix = getSheetMatrix(activeSheet)
    const absoluteCol = bounds.colStart + selectedColIdx
    const firstDataRow = pivot.hasHeader ? bounds.rowStart + 1 : bounds.rowStart
    const seen = new Set<string>()
    for (let r = firstDataRow; r <= bounds.rowEnd; r++) {
      const cell = matrix[r]?.[absoluteCol] ?? null
      const raw = getCellDisplayValue(cell)
      if (raw === null || raw === undefined || raw === '') continue
      const str = String(raw)
      if (!seen.has(str)) seen.add(str)
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [pivot, gridSheets, selectedColIdx])

  function handleInsert(): void {
    if (!pivot) {
      toast.error('No pivot table found — create one first via Insert > PivotTable.')
      return
    }
    if (distinctValues.length === 0) {
      toast.error('No values found in that column to slice by.')
      return
    }
    const label = pivot.headerLabels[selectedColIdx] || `Column ${selectedColIdx + 1}`
    addSlicer({
      label,
      kind: 'list',
      pivotId: pivot.id,
      columnIndex: selectedColIdx,
      allValues: distinctValues,
      selected: [],
      x: 240,
      y: 320,
      width: 200,
      height: 240,
    })
    toast.success(`Slicer added: ${label} (${distinctValues.length} values)`)
    closeBuilder()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeBuilder() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-500" />
            Insert Slicer
          </DialogTitle>
          <DialogDescription>
            A slicer lets users filter a PivotTable by clicking values. Pick
            which pivot to attach to and which column to slice by.
          </DialogDescription>
        </DialogHeader>

        {pivots.length === 0 ? (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-[12px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            No pivot tables yet. Create one via{' '}
            <span className="font-mono">Insert &gt; PivotTable</span> first,
            then come back here to add a slicer.
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <label htmlFor="slicer-pivot" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Pivot table
              </label>
              <select
                id="slicer-pivot"
                value={selectedPivotId ?? ''}
                onChange={(e) => { setSelectedPivotId(e.target.value); setSelectedColIdx(0) }}
                className="h-9 w-full rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {pivots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'Pivot table'} — {p.sourceRange}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="slicer-col" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Column to slice by
              </label>
              <select
                id="slicer-col"
                value={selectedColIdx}
                onChange={(e) => setSelectedColIdx(Number(e.target.value))}
                className="h-9 w-full rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {pivot?.headerLabels.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label || `Column ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {distinctValues.length > 0 && (
              <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-[12px] dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Preview ({distinctValues.length} distinct values)
                </div>
                <div className="flex flex-wrap gap-1">
                  {distinctValues.slice(0, 12).map((v, i) => (
                    <span key={i} className="rounded bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      {v}
                    </span>
                  ))}
                  {distinctValues.length > 12 && (
                    <span className="text-[11px] italic text-zinc-400">
                      … and {distinctValues.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
            disabled={pivots.length === 0 || distinctValues.length === 0}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Insert slicer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
