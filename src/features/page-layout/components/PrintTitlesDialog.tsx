'use client'

/**
 * PrintTitlesDialog — Page Layout > Print Titles.
 *
 * Lets the user specify row(s) to repeat at the top of every printed
 * PDF page (Excel's "Rows to repeat at top"). Stored in the print
 * settings store as `printTitles.rowsRange` (a 1-indexed range string
 * like "1:1" or "1:3"). The PDF exporter slices these rows from the
 * sheet data and prepends them to autoTable's `head` array — autoTable
 * then handles per-page repetition automatically.
 *
 * Column print titles are intentionally deferred — they require a
 * custom per-page rendering pass that autoTable doesn't expose.
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { usePrintTitlesDialogStore } from '../store/printTitlesDialogStore'
import { usePrintSettingsStore } from '../printSettingsStore'
import { useSheetStore } from '@/store/sheetStore'

const RANGE_RE = /^(\d+):(\d+)$/

export function PrintTitlesDialog() {
  const open = usePrintTitlesDialogStore((s) => s.open)
  const close = usePrintTitlesDialogStore((s) => s.closeDialog)
  const printTitles = usePrintSettingsStore((s) => s.printTitles)
  const setPrintTitleRows = usePrintSettingsStore((s) => s.setPrintTitleRows)
  const [rowsInput, setRowsInput] = useState<string>('')

  useEffect(() => {
    if (open) setRowsInput(printTitles.rowsRange ?? '')
  }, [open, printTitles.rowsRange])

  function setFromSelection() {
    const sel = useSheetStore.getState().selectedRange
    if (!sel) {
      toast.message('Select a row range first.')
      return
    }
    const startRow = Math.min(sel.start.row, sel.end.row) + 1
    const endRow   = Math.max(sel.start.row, sel.end.row) + 1
    setRowsInput(`${startRow}:${endRow}`)
  }

  function save() {
    const trimmed = rowsInput.trim()
    if (!trimmed) {
      setPrintTitleRows(null)
      toast.message('Print titles cleared')
      close()
      return
    }
    const m = trimmed.match(RANGE_RE)
    if (!m) {
      toast.error('Range must look like "1:1" or "1:3" (row numbers, 1-indexed).')
      return
    }
    const start = parseInt(m[1]!, 10)
    const end = parseInt(m[2]!, 10)
    if (start < 1 || end < start) {
      toast.error('Invalid row range — start must be ≥ 1 and end ≥ start.')
      return
    }
    setPrintTitleRows(`${start}:${end}`)
    toast.success(`Print titles: rows ${start}-${end}`)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Print Titles</DialogTitle>
          <DialogDescription>
            Pick row(s) to repeat at the top of every printed page.
            Useful for keeping column headers visible when a table
            spans multiple PDF pages.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-1">
          <div>
            <label htmlFor="pt-rows" className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
              Rows to repeat at top
            </label>
            <div className="flex gap-2">
              <input
                id="pt-rows"
                type="text"
                value={rowsInput}
                onChange={(e) => setRowsInput(e.target.value)}
                placeholder="e.g. 1:1 (just row 1) or 1:3 (rows 1-3)"
                className="h-8 flex-1 rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={setFromSelection}
                title="Use the currently-selected row range"
                className="rounded border border-zinc-300 px-2 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                From selection
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Format: <code>start:end</code> using 1-indexed row numbers.
              Leave blank to clear.
            </p>
          </div>

          <div className="rounded border border-dashed border-zinc-200 px-3 py-2 text-[10px] italic text-zinc-500 dark:border-zinc-700">
            Columns to repeat at left — coming soon.
          </div>
        </div>

        <DialogFooter className="gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setRowsInput(''); setPrintTitleRows(null); toast.message('Print titles cleared'); close() }}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
