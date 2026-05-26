'use client'

/**
 * AdvancedFilterDialog — Data > Sort & Filter > Advanced.
 *
 * Excel-style Advanced Filter: filter a list range using a criteria
 * range elsewhere on the sheet whose first row mirrors the data header
 * and whose subsequent rows hold AND/OR conditions.
 *
 * The dialog asks for:
 *  - List range  (defaults to current selection)
 *  - Criteria range (required, no default)
 *  - Action  (Filter the list, in-place  |  Copy to another location)
 *      The second option is a stub — Excel's "copy to" path is
 *      significantly more work than the criteria evaluator itself, so
 *      v1 ships only the in-place mode (the common case).
 *
 * On OK we evaluate the criteria + apply to FortuneSheet's
 * `config.rowhidden` via `applyAdvancedFilterToActiveSheet`. The
 * existing basic filter (FilterPanel) keeps its own state — the two
 * filter mechanisms OR together at row-hide time.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { WandSparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { useAdvancedFilterStore } from '../store/advancedFilterStore'
import {
  evaluateAdvancedFilter,
  formatA1Range,
  parseA1Range,
} from '../utils/advancedFilter'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'

type FilterAction = 'in-place' | 'copy'

export function AdvancedFilterDialog() {
  const open = useAdvancedFilterStore((s) => s.dialogOpen)
  const closeDialog = useAdvancedFilterStore((s) => s.closeDialog)
  const criteriaBySheet = useAdvancedFilterStore((s) => s.criteriaBySheet)
  const activeSheetId = useWorkbookStore((s) => s.activeSheetId)
  const selectedRange = useSheetStore((s) => s.selectedRange)
  const selectedCell = useSheetStore((s) => s.selectedCell)
  const applyAdvancedFilter = useSheetStore((s) => s.applyAdvancedFilterToActiveSheet)

  // ── Local form state ──────────────────────────────────────────────
  const [listRange, setListRange] = useState('')
  const [criteriaRange, setCriteriaRange] = useState('')
  const [action, setAction] = useState<FilterAction>('in-place')
  const [error, setError] = useState<string | null>(null)

  // Default the list range from the current selection (or the persisted
  // criteria if we have one). Selection wins if both exist so the user
  // can quickly re-run with a different range.
  const defaultListRange = useMemo(() => {
    if (selectedRange) {
      return formatA1Range({
        startRow: Math.min(selectedRange.start.row, selectedRange.end.row),
        endRow:   Math.max(selectedRange.start.row, selectedRange.end.row),
        startCol: Math.min(selectedRange.start.col, selectedRange.end.col),
        endCol:   Math.max(selectedRange.start.col, selectedRange.end.col),
      })
    }
    if (selectedCell) {
      return formatA1Range({
        startRow: selectedCell.row,
        endRow:   selectedCell.row,
        startCol: selectedCell.col,
        endCol:   selectedCell.col,
      })
    }
    return ''
  }, [selectedRange, selectedCell])

  // Hydrate the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    const stored = criteriaBySheet[activeSheetId]
    setListRange(stored?.listRange ?? defaultListRange)
    setCriteriaRange(stored?.criteriaRange ?? '')
    setAction('in-place')
    setError(null)
  }, [open, activeSheetId, criteriaBySheet, defaultListRange])

  function handleApply() {
    setError(null)

    const trimmedList = listRange.trim()
    const trimmedCrit = criteriaRange.trim()

    if (!trimmedList) {
      setError('Enter a list range (the table to filter).')
      return
    }
    if (!trimmedCrit) {
      setError('Enter a criteria range.')
      return
    }

    if (action === 'copy') {
      // Stub — disabled in the radio anyway; defensive guard if state is forced.
      toast.message('Copy to another location — coming soon.')
      return
    }

    // Validate by attempting to parse + evaluate before persisting.
    try {
      parseA1Range(trimmedList)
      parseA1Range(trimmedCrit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid range.')
      return
    }

    const gridSheets = useSheetStore.getState().gridSheets
    const sheet = gridSheets.find((s) => s.id === activeSheetId) ?? gridSheets.find((s) => s.status === 1)
    if (!sheet) {
      setError('No active sheet.')
      return
    }

    // Build a plain display matrix for the evaluator.
    const matrix: (string | number | boolean | null)[][] = getSheetMatrix(sheet).map((row) =>
      (row ?? []).map((cell) => {
        const v = getCellDisplayValue(cell)
        return v === undefined ? null : (v as string | number | boolean | null)
      })
    )

    let result: ReturnType<typeof evaluateAdvancedFilter>
    try {
      result = evaluateAdvancedFilter(matrix, { listRange: trimmedList, criteriaRange: trimmedCrit })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not evaluate criteria.')
      return
    }

    applyAdvancedFilter({ listRange: trimmedList, criteriaRange: trimmedCrit })
    toast.success(
      `Advanced filter applied — ${result.matchedRowCount} of ${result.totalDataRows} rows match.`
    )
    closeDialog()
  }

  function handleClear() {
    applyAdvancedFilter(null)
    setListRange(defaultListRange)
    setCriteriaRange('')
    setError(null)
    toast.success('Advanced filter cleared')
    closeDialog()
  }

  const hasActiveCriteria = Boolean(criteriaBySheet[activeSheetId])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-blue-500" />
            Advanced Filter
          </DialogTitle>
          <DialogDescription>
            Filter a list using a criteria range whose first row mirrors the
            data header. Conditions in the same row are AND-ed; conditions
            in different rows are OR-ed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 pt-2">
          {/* Action radios */}
          <fieldset className="grid gap-1.5">
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Action
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="advfilter-action"
                value="in-place"
                checked={action === 'in-place'}
                onChange={() => setAction('in-place')}
              />
              Filter the list, in-place
            </label>
            <label
              className="flex cursor-not-allowed items-center gap-2 text-sm text-zinc-400"
              title="Coming soon — Excel's Copy-to-another-location mode is not yet implemented."
            >
              <input
                type="radio"
                name="advfilter-action"
                value="copy"
                checked={action === 'copy'}
                disabled
                onChange={() => { /* disabled */ }}
              />
              Copy to another location
              <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                coming soon
              </span>
            </label>
          </fieldset>

          {/* List range */}
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              List range
            </span>
            <input
              type="text"
              value={listRange}
              onChange={(e) => setListRange(e.target.value)}
              placeholder="A1:E15"
              className="h-9 rounded border border-zinc-300 px-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="text-[10px] text-zinc-500">
              Defaults to your current selection. Include the header row.
            </span>
          </label>

          {/* Criteria range */}
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Criteria range
            </span>
            <input
              type="text"
              value={criteriaRange}
              onChange={(e) => setCriteriaRange(e.target.value)}
              placeholder="A20:B22"
              className="h-9 rounded border border-zinc-300 px-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="text-[10px] text-zinc-500">
              Header row must match column names in the list range.
              Operators: <code>=</code> <code>&gt;</code> <code>&lt;</code>{' '}
              <code>&gt;=</code> <code>&lt;=</code> <code>&lt;&gt;</code>{' '}
              <code>value*</code>.
            </span>
          </label>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 sm:justify-between">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasActiveCriteria}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear filter
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
