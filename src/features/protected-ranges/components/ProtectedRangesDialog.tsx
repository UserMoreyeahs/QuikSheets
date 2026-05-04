'use client'

/**
 * ProtectedRangesDialog
 * --------------------------------------------------------------------------
 * Modal that lists existing protected ranges for the active workbook + sheet
 * and lets the user add/remove them.
 *
 * Uses the localStorage store (works without Supabase).  The grid checks
 * isCellProtected() before allowing edits.
 */

import { useEffect, useMemo, useState } from 'react'
import { Lock, X, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProtectedRangesUiStore } from '@/features/protected-ranges/store/protectedRangesUiStore'
import {
  addLocalProtectedRange,
  deleteLocalProtectedRange,
  listLocalProtectedRanges,
  type LocalProtectedRange,
} from '@/features/protected-ranges/storage/localProtectedRanges'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { boundsToA1, parseA1Range } from '@/features/charts/utils/rangeUtils'

export function ProtectedRangesDialog({ workbookId }: { workbookId: string }) {
  const open = useProtectedRangesUiStore((s) => s.isOpen)
  const close = useProtectedRangesUiStore((s) => s.close)
  const version = useProtectedRangesUiStore((s) => s.version)
  const bump = useProtectedRangesUiStore((s) => s.bump)

  const { selectedCell, selectedRange } = useSheetStore()
  const { activeSheetId, sheets } = useWorkbookStore()

  const [rangeText, setRangeText] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setDescription('')
    if (selectedRange) {
      setRangeText(boundsToA1({
        rowStart: Math.min(selectedRange.start.row, selectedRange.end.row),
        rowEnd:   Math.max(selectedRange.start.row, selectedRange.end.row),
        colStart: Math.min(selectedRange.start.col, selectedRange.end.col),
        colEnd:   Math.max(selectedRange.start.col, selectedRange.end.col),
      }))
    } else if (selectedCell) {
      setRangeText(boundsToA1({
        rowStart: selectedCell.row,
        rowEnd:   selectedCell.row,
        colStart: selectedCell.col,
        colEnd:   selectedCell.col,
      }))
    } else {
      setRangeText('')
    }
  }, [open, selectedCell, selectedRange])

  const ranges = useMemo<LocalProtectedRange[]>(() => {
    void version
    return listLocalProtectedRanges(workbookId)
  }, [workbookId, version])

  if (!open) return null

  const rangeIsValid = parseA1Range(rangeText) !== null

  function add() {
    if (!activeSheetId) { toast.error('No active sheet.'); return }
    if (!rangeIsValid) { toast.error('Enter a valid range like B2:D10.'); return }
    addLocalProtectedRange({
      workbookId,
      sheetId: activeSheetId,
      rangeRef: rangeText,
      description: description.trim() || null,
    })
    bump()
    setRangeText('')
    setDescription('')
    toast.success('Range protected.')
  }

  function remove(r: LocalProtectedRange) {
    if (!confirm(`Remove protection on ${r.rangeRef}?`)) return
    deleteLocalProtectedRange(workbookId, r.id)
    bump()
    toast.success('Protection removed.')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Protected ranges</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Add protection
          </div>
          <div className="grid grid-cols-[140px,1fr,auto] items-center gap-2">
            <input
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              placeholder="A1:C10"
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 font-mono text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note (e.g. 'Locked formulas')"
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={add}
              disabled={!rangeIsValid}
              className="flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Protect
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Protected cells block edits in the grid for everyone using this workbook locally.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Existing protections
          </div>
          {ranges.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-300 text-[12px] text-zinc-400 dark:border-zinc-700">
              No protected ranges in this workbook.
            </div>
          ) : (
            <ul className="space-y-1">
              {ranges.map((r) => {
                const sheetName = sheets.find((s) => s.id === r.sheetId)?.name ?? r.sheetId
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                  >
                    <Lock className="h-3 w-3 shrink-0 text-rose-500" />
                    <code className="font-mono text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
                      {sheetName}!{r.rangeRef}
                    </code>
                    {r.description && (
                      <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">— {r.description}</span>
                    )}
                    <span className="ml-auto text-[10px] text-zinc-400">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      aria-label="Remove protection"
                      className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
