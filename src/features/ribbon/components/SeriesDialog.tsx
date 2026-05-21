'use client'

/**
 * SeriesDialog — Excel-faithful Fill > Series dialog.
 *
 * Replaces the previous two sequential window.prompt() calls (which
 * felt clunky and didn't let the user back out cleanly).
 *
 * Fields (matching Excel's Format > Series dialog):
 *   - Series in: Rows / Columns (auto-detected from selection)
 *   - Type:      Linear (Add step each cell) / Growth (Multiply)
 *   - Step value
 *   - Stop value (optional — caps the series)
 *
 * The Date / AutoFill series types are deferred — they need date
 * arithmetic helpers we haven't built yet.
 */

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSheetStore } from '@/store/sheetStore'
import { toast } from 'sonner'

export type SeriesType = 'linear' | 'growth'

interface SeriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SeriesDialog({ open, onOpenChange }: SeriesDialogProps) {
  const { selectedCell, selectedRange, gridInstance } = useSheetStore()
  const [direction, setDirection] = useState<'rows' | 'cols'>('cols')
  const [type, setType] = useState<SeriesType>('linear')
  const [start, setStart] = useState('1')
  const [step, setStep] = useState('1')
  const [stopValue, setStopValue] = useState('')

  // Auto-detect direction when dialog opens. Vertical-tall selection
  // → fill down columns; horizontal-wide → fill right across rows.
  useEffect(() => {
    if (!open || !selectedRange) return
    const rows = Math.abs(selectedRange.end.row - selectedRange.start.row)
    const cols = Math.abs(selectedRange.end.col - selectedRange.start.col)
    setDirection(rows >= cols ? 'cols' : 'rows')
    // Pre-fill Start from the first selected cell if it's numeric.
    if (selectedCell && gridInstance) {
      try {
        const sheets = (gridInstance as unknown as { getAllSheets: () => unknown[] }).getAllSheets()
        const sheet = (sheets[0] ?? null) as { data?: Array<Array<{ v?: unknown } | null>> } | null
        const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col]
        const v = cell?.v
        if (typeof v === 'number' && Number.isFinite(v)) setStart(String(v))
      } catch { /* ignore */ }
    }
  }, [open, selectedRange, selectedCell, gridInstance])

  function apply() {
    if (!selectedRange || !gridInstance) {
      toast.message('Select a range first')
      return
    }
    const s = Number(start)
    const k = Number(step)
    const stop = stopValue.trim() === '' ? Number.POSITIVE_INFINITY : Number(stopValue)
    if (!Number.isFinite(s) || !Number.isFinite(k)) {
      toast.error('Enter valid numbers for Start and Step')
      return
    }
    if (stopValue.trim() !== '' && !Number.isFinite(stop)) {
      toast.error('Stop value must be a number')
      return
    }
    if (type === 'growth' && k === 0) {
      toast.error('Growth step cannot be zero')
      return
    }

    const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
    const er = Math.max(selectedRange.start.row, selectedRange.end.row)
    const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
    const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
    const setVal = (gridInstance as unknown as {
      setCellValue: (r: number, c: number, v: unknown) => void
    }).setCellValue

    try {
      const nextValue = (current: number) => (type === 'growth' ? current * k : current + k)
      let written = 0

      if (direction === 'cols') {
        // Fill down each selected column.
        for (let c = sc; c <= ec; c++) {
          let v = s
          for (let r = sr; r <= er; r++) {
            if (Math.abs(v) > Math.abs(stop)) break
            setVal(r, c, v)
            written++
            v = nextValue(v)
          }
        }
      } else {
        // Fill right across each selected row.
        for (let r = sr; r <= er; r++) {
          let v = s
          for (let c = sc; c <= ec; c++) {
            if (Math.abs(v) > Math.abs(stop)) break
            setVal(r, c, v)
            written++
            v = nextValue(v)
          }
        }
      }
      toast.success(`Series filled (${written} cells)`)
      onOpenChange(false)
    } catch (e) {
      toast.error(`Series fill failed: ${String(e)}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Series</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Series in */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Series in
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('rows')}
                className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors ${
                  direction === 'rows'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                Rows (→)
              </button>
              <button
                type="button"
                onClick={() => setDirection('cols')}
                className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors ${
                  direction === 'cols'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                Columns (↓)
              </button>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Type
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setType('linear')}
                className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors ${
                  type === 'linear'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                Linear (+step)
              </button>
              <button
                type="button"
                onClick={() => setType('growth')}
                className={`flex-1 rounded border px-3 py-1.5 text-sm transition-colors ${
                  type === 'growth'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                Growth (×step)
              </button>
            </div>
          </div>

          {/* Start + Step + Stop */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Start
              </label>
              <Input
                type="text"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Step
              </label>
              <Input
                type="text"
                value={step}
                onChange={(e) => setStep(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Stop (opt)
              </label>
              <Input
                type="text"
                value={stopValue}
                onChange={(e) => setStopValue(e.target.value)}
                placeholder="∞"
                className="mt-1"
              />
            </div>
          </div>

          {/* Preview line */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Preview:{' '}
            {(() => {
              const s = Number(start), k = Number(step)
              if (!Number.isFinite(s) || !Number.isFinite(k)) return '—'
              const next = (v: number) => (type === 'growth' ? v * k : v + k)
              const seq: number[] = []
              let v = s
              for (let i = 0; i < 4; i++) { seq.push(v); v = next(v) }
              return seq.join(', ') + ', …'
            })()}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
