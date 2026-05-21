'use client'

/**
 * TextToColumnsDialog
 * --------------------------------------------------------------------------
 * Excel-equivalent of Data > Text to Columns. Splits the active column's
 * cells by a chosen delimiter (or fixed-width), writes the parts into the
 * adjacent columns to the right.
 *
 * Mirrors Excel's two-step wizard but collapsed into a single dialog
 * with a live preview pane (shows the first 5 rows as they'd appear
 * after the split).
 *
 * Anchoring rules:
 *   • Source column = column of selectedCell
 *   • Source rows  = selectedRange (or the whole column if no range)
 *   • Output columns = source column, source+1, source+2, … (overwrites
 *     whatever was in those adjacent cells — same as Excel)
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSheetStore } from '@/store/sheetStore'
import {
  cloneSheetWithData,
  getCellDisplayValue,
  getSheetMatrix,
} from '@/lib/fortuneSheet'
import type { Cell } from '@fortune-sheet/core'

interface TextToColumnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Delimiter = 'comma' | 'tab' | 'semicolon' | 'space' | 'custom'

const DELIM_LABELS: Record<Delimiter, string> = {
  comma:     'Comma  (,)',
  tab:       'Tab',
  semicolon: 'Semicolon  (;)',
  space:     'Space',
  custom:    'Custom',
}

function getDelimiterString(d: Delimiter, custom: string): string {
  switch (d) {
    case 'comma':     return ','
    case 'tab':       return '\t'
    case 'semicolon': return ';'
    case 'space':     return ' '
    case 'custom':    return custom || ','
  }
}

export function TextToColumnsDialog({ open, onOpenChange }: TextToColumnsDialogProps) {
  const { gridSheets, selectedCell, selectedRange, replaceGridSheets } = useSheetStore()
  const [delimiter, setDelimiter] = useState<Delimiter>('comma')
  const [customDelim, setCustomDelim] = useState(',')
  const [trimParts, setTrimParts] = useState(true)

  const activeSheet = useMemo(
    () => gridSheets.find((s) => s.status === 1) ?? gridSheets[0],
    [gridSheets],
  )

  // Determine source column + row range.
  const sourceCol = selectedCell?.col ?? 0
  const rowStart = selectedRange
    ? Math.min(selectedRange.start.row, selectedRange.end.row)
    : selectedCell?.row ?? 0
  const rowEnd = selectedRange
    ? Math.max(selectedRange.start.row, selectedRange.end.row)
    : selectedCell?.row ?? 0

  // Source values to split.
  const sourceValues = useMemo<string[]>(() => {
    if (!activeSheet) return []
    const matrix = getSheetMatrix(activeSheet)
    const out: string[] = []
    for (let r = rowStart; r <= rowEnd; r++) {
      const cell = matrix[r]?.[sourceCol] ?? null
      const v = getCellDisplayValue(cell)
      out.push(v == null ? '' : String(v))
    }
    return out
  }, [activeSheet, rowStart, rowEnd, sourceCol])

  // Preview: split each row by the chosen delimiter.
  const previewRows = useMemo<string[][]>(() => {
    const sep = getDelimiterString(delimiter, customDelim)
    return sourceValues.slice(0, 5).map((v) =>
      v.split(sep).map((p) => (trimParts ? p.trim() : p)),
    )
  }, [sourceValues, delimiter, customDelim, trimParts])

  const maxParts = useMemo(
    () => previewRows.reduce((m, row) => Math.max(m, row.length), 0),
    [previewRows],
  )

  useEffect(() => {
    if (!open) return
    // Default to comma when opening
    setDelimiter('comma')
    setCustomDelim(',')
    setTrimParts(true)
  }, [open])

  function handleSplit(): void {
    if (!activeSheet) return
    if (sourceValues.length === 0) {
      toast.error('No cells to split.')
      return
    }
    const sep = getDelimiterString(delimiter, customDelim)
    const matrix = getSheetMatrix(activeSheet)
    const next = matrix.map((row) => [...(row ?? [])])

    let changedRows = 0
    const allParts: string[][] = sourceValues.map((v) => {
      const parts = v.split(sep).map((p) => (trimParts ? p.trim() : p))
      if (parts.length > 1) changedRows++
      return parts
    })
    const widestParts = allParts.reduce((m, row) => Math.max(m, row.length), 0)

    sourceValues.forEach((_, i) => {
      const r = rowStart + i
      const parts = allParts[i] ?? []
      if (!next[r]) next[r] = []
      for (let p = 0; p < widestParts; p++) {
        const part = parts[p] ?? ''
        const c = sourceCol + p
        const partAsNum = Number(part)
        const cellValue: Cell =
          part !== '' && !isNaN(partAsNum)
            ? { ct: { fa: 'General', t: 'n' }, m: part, v: partAsNum }
            : { ct: { fa: 'General', t: 'g' }, m: part, v: part }
        next[r]![c] = cellValue
      }
    })

    const nextSheets = gridSheets.map((s) =>
      s.id === activeSheet.id ? cloneSheetWithData(s, next as Cell[][]) : s,
    )
    replaceGridSheets(nextSheets)

    toast.success(
      changedRows === 0
        ? 'No rows split — delimiter not found in any cell.'
        : `Split ${changedRows} row${changedRows === 1 ? '' : 's'} into ${widestParts} columns.`,
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Text to Columns</DialogTitle>
          <DialogDescription>
            Split the selected column on a chosen delimiter. The resulting parts
            overwrite cells in the same row, starting from the source column.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[12px] dark:border-zinc-700 dark:bg-zinc-800/30">
            <span className="font-mono text-zinc-500">Source</span>
            <span>Column {String.fromCharCode(65 + sourceCol)}, rows {rowStart + 1}–{rowEnd + 1}</span>
            <span className="ml-auto text-zinc-400">({sourceValues.length} cell{sourceValues.length === 1 ? '' : 's'})</span>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Delimiter
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(DELIM_LABELS) as Delimiter[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDelimiter(d)}
                  className={
                    'rounded border px-2.5 py-1.5 text-left text-[12px] ' +
                    (delimiter === d
                      ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800')
                  }
                >
                  {DELIM_LABELS[d]}
                </button>
              ))}
            </div>
            {delimiter === 'custom' && (
              <input
                type="text"
                value={customDelim}
                onChange={(e) => setCustomDelim(e.target.value)}
                placeholder="Enter custom delimiter (e.g. | or - or —)"
                maxLength={5}
                className="mt-2 h-8 w-40 rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={trimParts}
              onChange={(e) => setTrimParts(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-blue-600"
            />
            Trim whitespace from each part
          </label>

          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Preview (first {Math.min(5, sourceValues.length)} row{Math.min(5, sourceValues.length) === 1 ? '' : 's'})
            </div>
            {previewRows.length === 0 ? (
              <div className="rounded border border-dashed border-zinc-200 p-3 text-[12px] text-zinc-500">
                No cells to split.
              </div>
            ) : (
              <div className="overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-[11px]">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/40">
                    <tr>
                      {Array.from({ length: maxParts }).map((_, i) => (
                        <th key={i} className="border-b border-zinc-200 px-2 py-1 text-left font-medium text-zinc-500 dark:border-zinc-700">
                          {String.fromCharCode(65 + sourceCol + i)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri}>
                        {Array.from({ length: maxParts }).map((_, ci) => (
                          <td key={ci} className="border-b border-zinc-100 px-2 py-1 font-mono text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                            {row[ci] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSplit}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Split
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
