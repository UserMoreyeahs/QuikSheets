'use client'

/**
 * CleanDataPanel
 * --------------------------------------------------------------------------
 * Floating panel (right side) that runs cleaning operations on the currently
 * selected column / range. Operations are split into:
 *
 *   ── Deterministic (instant, no network) ─────────────────────────────
 *     • Trim whitespace
 *     • UPPERCASE / lowercase / Title Case
 *     • Phone normalize    →  +91-XXXXXXXXXX
 *     • Date → ISO         →  YYYY-MM-DD
 *
 *   ── AI-assisted (Groq, slower) ──────────────────────────────────────
 *     • Custom instruction — "extract only the city", "normalize currencies
 *       to USD", "remove emojis", etc.
 *
 * Workflow:  user selects op → preview shows before/after diff count →
 * user clicks Apply → cells are written back to the active sheet via the
 * standard cloneSheetWithData pattern, which is undo-able through the
 * existing undo stack.
 */

import { useMemo, useState, useTransition } from 'react'
import { X, Sparkles, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  applyDeterministic,
  diffCount,
  type CleanOp,
} from '@/features/data-cleaning/utils/cleaners'
import { useCleanDataStore } from '@/features/data-cleaning/store/cleanDataStore'
import { useSheetStore } from '@/store/sheetStore'
import { cloneSheetWithData, getSheetMatrix, getCellDisplayValue } from '@/lib/fortuneSheet'
import { cn } from '@/lib/utils'
import type { Cell } from '@fortune-sheet/core'

interface OpButton {
  op: CleanOp
  label: string
  hint: string
  ai?: boolean
}

const OPS: OpButton[] = [
  { op: 'trim',      label: 'Trim whitespace', hint: 'Strip leading/trailing spaces and collapse multiple spaces.' },
  { op: 'lowercase', label: 'lowercase',       hint: 'Convert to lower case.' },
  { op: 'uppercase', label: 'UPPERCASE',       hint: 'Convert to upper case.' },
  { op: 'titlecase', label: 'Title Case',      hint: 'Capitalise each word.' },
  { op: 'phone',     label: 'Phone numbers',   hint: 'Normalise to +CC-NNNNNNNNNN (defaults to +91).' },
  { op: 'date_iso',  label: 'Dates → ISO',     hint: 'Parse mixed date formats and write YYYY-MM-DD.' },
  { op: 'custom',    label: 'Custom (AI)',     hint: 'Type a plain-English cleaning instruction.', ai: true },
]

type Selection = { rowStart: number; rowEnd: number; colStart: number; colEnd: number }

function getSelection(state: ReturnType<typeof useSheetStore.getState>): Selection | null {
  const cell = state.selectedCell
  const range = state.selectedRange
  if (!cell) return null
  if (!range) {
    return { rowStart: cell.row, rowEnd: cell.row, colStart: cell.col, colEnd: cell.col }
  }
  return {
    rowStart: Math.min(range.start.row, range.end.row),
    rowEnd:   Math.max(range.start.row, range.end.row),
    colStart: Math.min(range.start.col, range.end.col),
    colEnd:   Math.max(range.start.col, range.end.col),
  }
}

export function CleanDataPanel() {
  const isOpen = useCleanDataStore((s) => s.isOpen)
  const close = useCleanDataStore((s) => s.close)

  const sheetState = useSheetStore()
  const { gridSheets, replaceGridSheets } = sheetState

  const [op, setOp] = useState<CleanOp>('trim')
  const [instruction, setInstruction] = useState('')
  const [aiPending, startAi] = useTransition()
  const [aiCleaned, setAiCleaned] = useState<string[] | null>(null)

  const selection = useMemo(() => getSelection(sheetState), [sheetState])

  const activeSheet = useMemo(() => gridSheets.find((s) => s.status === 1) ?? gridSheets[0], [gridSheets])

  // values currently in the selected range, flattened in row-major order
  const selectedValues = useMemo(() => {
    if (!selection || !activeSheet) return [] as string[]
    const matrix = getSheetMatrix(activeSheet)
    const out: string[] = []
    for (let r = selection.rowStart; r <= selection.rowEnd; r++) {
      for (let c = selection.colStart; c <= selection.colEnd; c++) {
        const cell = matrix[r]?.[c] ?? null
        const display = getCellDisplayValue(cell)
        out.push(display === null || display === undefined ? '' : String(display))
      }
    }
    return out
  }, [selection, activeSheet])

  // preview
  const previewCleaned = useMemo<string[]>(() => {
    if (op === 'custom') return aiCleaned ?? selectedValues
    return applyDeterministic(selectedValues, op)
  }, [op, selectedValues, aiCleaned])

  const changedCount = useMemo(
    () => diffCount(selectedValues, previewCleaned),
    [selectedValues, previewCleaned]
  )

  if (!isOpen) return null

  const hasSelection = selection !== null && selectedValues.length > 0
  const tooMany = selectedValues.length > 500

  // ── AI run ──────────────────────────────────────────────────────────
  function runAi() {
    if (op !== 'custom') return
    if (!instruction.trim()) {
      toast.error('Type an instruction first.')
      return
    }
    if (selectedValues.length === 0) {
      toast.error('Select some cells first.')
      return
    }
    if (selectedValues.length > 500) {
      toast.error('Too many cells — keep it under 500 per pass.')
      return
    }

    startAi(async () => {
      try {
        const res = await fetch('/api/ai/clean', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: selectedValues, instruction: instruction.trim() }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? `AI request failed (${res.status})`)
        }
        const json = (await res.json()) as { cleaned: string[]; changed: number; summary: string }
        setAiCleaned(json.cleaned)
        toast.success(json.summary || `${json.changed} value${json.changed === 1 ? '' : 's'} updated.`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI request failed.'
        toast.error(msg)
        setAiCleaned(null)
      }
    })
  }

  // ── Apply: write previewCleaned back into the active sheet ─────────
  function apply() {
    if (!selection || !activeSheet || !hasSelection) return
    if (changedCount === 0) {
      toast.message('Nothing to change.')
      close()
      return
    }

    const matrix = getSheetMatrix(activeSheet)
    const next = matrix.map((row) => [...(row ?? [])])

    let i = 0
    for (let r = selection.rowStart; r <= selection.rowEnd; r++) {
      if (!next[r]) next[r] = []
      for (let c = selection.colStart; c <= selection.colEnd; c++) {
        const newValue = previewCleaned[i++] ?? ''
        const existing = (next[r]![c] ?? null) as Cell | null
        // preserve formatting; just rewrite v / m, drop f (we replaced raw value)
        const updated: Cell = { ...(existing ?? {}), v: newValue, m: newValue }
        delete (updated as Record<string, unknown>).f
        next[r]![c] = updated
      }
    }

    const activeIndex = gridSheets.findIndex((s) => s === activeSheet)
    const nextSheets = gridSheets.map((sheet, idx) =>
      idx === activeIndex ? cloneSheetWithData(sheet, next) : sheet
    )
    replaceGridSheets(nextSheets)
    toast.success(`Cleaned ${changedCount} cell${changedCount === 1 ? '' : 's'}.`)
    setAiCleaned(null)
    close()
  }

  return (
    <div className="fixed right-4 top-[140px] z-50 w-[340px] rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      {/* header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Clean Data</span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close clean data panel"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* selection summary */}
      <div className="px-4 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        {hasSelection
          ? <>Selection: <span className="font-mono text-zinc-700 dark:text-zinc-200">{selectedValues.length}</span> cell{selectedValues.length === 1 ? '' : 's'}</>
          : <>Select a range first — then choose an operation below.</>}
        {tooMany && <span className="ml-1 text-orange-500">(max 500 per pass)</span>}
      </div>

      {/* operation list */}
      <div className="max-h-[60vh] overflow-y-auto p-3">
        <div className="grid gap-1">
          {OPS.map((entry) => (
            <button
              key={entry.op}
              type="button"
              onClick={() => { setOp(entry.op); setAiCleaned(null) }}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                op === entry.op
                  ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:ring-blue-800'
                  : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800',
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                {entry.label}
                {entry.ai && <Sparkles className="h-3 w-3 text-amber-500" />}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{entry.hint}</span>
            </button>
          ))}
        </div>

        {/* custom instruction */}
        {op === 'custom' && (
          <div className="mt-3">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Instruction
            </label>
            <textarea
              value={instruction}
              onChange={(e) => { setInstruction(e.target.value); setAiCleaned(null) }}
              placeholder='e.g. "extract only the city" or "round to 2 decimals"'
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={runAi}
              disabled={aiPending || !instruction.trim() || !hasSelection}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cleaning…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Run AI
                </>
              )}
            </button>
          </div>
        )}

        {/* preview */}
        {hasSelection && (op !== 'custom' || aiCleaned !== null) && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">
              Preview — {changedCount} of {selectedValues.length} will change
            </div>
            <div className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
              {selectedValues.slice(0, 8).map((before, i) => {
                const after = previewCleaned[i] ?? ''
                if (before === after) {
                  return <div key={i} className="text-zinc-400 dark:text-zinc-500 truncate">= {before || '(empty)'}</div>
                }
                return (
                  <div key={i} className="flex flex-col">
                    <span className="truncate text-rose-500 line-through opacity-70">{before || '(empty)'}</span>
                    <span className="truncate text-emerald-600 dark:text-emerald-400">→ {after || '(empty)'}</span>
                  </div>
                )
              })}
              {selectedValues.length > 8 && (
                <div className="text-zinc-400 dark:text-zinc-500">… and {selectedValues.length - 8} more</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <button
          type="button"
          onClick={close}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!hasSelection || changedCount === 0 || (op === 'custom' && aiCleaned === null)}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Apply ({changedCount})
        </button>
      </div>
    </div>
  )
}
