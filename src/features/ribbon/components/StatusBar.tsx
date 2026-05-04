'use client'

/**
 * StatusBar
 * Slim bar at the bottom of the grid (above sheet tabs), showing:
 *   Left  — cell address | sheet name | active-filter badge
 *   Right — Sum · Avg · Min · Max · Count for the selected numeric range
 *
 * Mirrors the Excel / Google Sheets experience that users expect.
 */

import { useMemo } from 'react'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { colIndexToLetter } from '@/lib/cellAddress'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Format a number compactly: no trailing zeros, thousands separator. */
function fmtNum(n: number): string {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000)
    return n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 } as Intl.NumberFormatOptions)
  if (!Number.isInteger(n))
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString()
}

/** Summarise a list of numbers. Returns null when the list is empty. */
function summarise(values: number[]) {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    sum,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export function StatusBar() {
  const { selectedCell, selectedRange, gridSheets, activeFilters } = useSheetStore()
  const { sheets, activeSheetId } = useWorkbookStore()

  const activeGridSheet = gridSheets.find((s) => s.id === activeSheetId) ?? gridSheets[0]
  const activeSheetName = sheets.find((s) => s.id === activeSheetId)?.name ?? ''

  // ── cell address string (e.g. "B3" or "A1:C10") ──────────────────────────
  const cellAddress = useMemo(() => {
    if (!selectedCell) return ''
    const col = colIndexToLetter(selectedCell.col)
    const row = selectedCell.row + 1
    if (!selectedRange) return `${col}${row}`
    const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
    const er = Math.max(selectedRange.start.row, selectedRange.end.row)
    const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
    const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
    if (sr === er && sc === ec) return `${col}${row}`
    return `${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`
  }, [selectedCell, selectedRange])

  // ── range stats (skip for single-cell or huge ranges) ────────────────────
  const stats = useMemo(() => {
    if (!selectedRange || !activeGridSheet) return null
    const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
    const er = Math.max(selectedRange.start.row, selectedRange.end.row)
    const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
    const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
    if (sr === er && sc === ec) return null // single cell — nothing to show
    if ((er - sr + 1) * (ec - sc + 1) > 50_000) return null // too large — skip

    const matrix = getSheetMatrix(activeGridSheet)
    const numbers: number[] = []
    for (let r = sr; r <= er; r++) {
      for (let c = sc; c <= ec; c++) {
        const raw = getCellDisplayValue(matrix[r]?.[c] ?? null)
        if (raw !== null && raw !== '') {
          const n = Number(raw)
          if (!isNaN(n)) numbers.push(n)
        }
      }
    }
    return summarise(numbers)
  }, [selectedRange, activeGridSheet])

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
      {/* ── Left: address + sheet + filter badge ─────────────────────────── */}
      <div className="flex items-center gap-3">
        {cellAddress && (
          <span className="font-mono text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
            {cellAddress}
          </span>
        )}
        {activeSheetName && (
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{activeSheetName}</span>
        )}
        {activeFilters.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            {activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* ── Right: numeric range stats ───────────────────────────────────── */}
      {stats && (
        <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
          <Stat label="Sum" value={fmtNum(stats.sum)} />
          <Stat label="Avg" value={fmtNum(stats.avg)} />
          <Stat label="Min" value={fmtNum(stats.min)} />
          <Stat label="Max" value={fmtNum(stats.max)} />
          <Stat label="Count" value={String(stats.count)} />
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="px-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
      {label}:{' '}
      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{value}</span>
    </span>
  )
}
