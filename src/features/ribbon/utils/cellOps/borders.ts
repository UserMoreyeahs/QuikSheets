'use client'

/**
 * Border + cross-row merge cell operations.
 *
 * Extracted from src/features/ribbon/utils/cellOps.ts (Wave 4 split).
 * Public API is re-exported from cellOps.ts for back-compat — all
 * existing call sites stay byte-identical.
 */

import { toast } from 'sonner'
import { useWorkbookStore } from '@/store/workbookStore'
import { selectionRows, selectionCols, getInstance } from './shared'

export type BorderPreset =
  | 'all'
  | 'outside'
  | 'thick'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'none'

const BORDER_TYPE_MAP: Record<BorderPreset, string> = {
  all:     'border-all',
  outside: 'border-outside',
  thick:   'border-outside',
  top:     'border-top',
  bottom:  'border-bottom',
  left:    'border-left',
  right:   'border-right',
  none:    'border-none',
}

/** FortuneSheet line-style index. */
export type BorderLineStyle = '1' | '2' | '3' | '4'

/** Default border options — black thin solid. */
const DEFAULT_BORDER_OPTS = { color: '#000000', style: '1' as BorderLineStyle }

/**
 * Apply a border preset to the current selection.
 *
 * @param preset  Which edges receive the border (top/bottom/all/etc.)
 * @param opts    Optional per-call overrides for color + line style.
 *                When omitted, defaults to black thin solid (matching
 *                the previous behaviour exactly). The 'thick' preset
 *                upgrades to style '4' unless an explicit style is given.
 */
export function applyBorder(
  preset: BorderPreset,
  opts?: { color?: string; style?: BorderLineStyle },
): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  const color = opts?.color ?? DEFAULT_BORDER_OPTS.color
  const style = opts?.style ?? (preset === 'thick' ? '4' : DEFAULT_BORDER_OPTS.style)

  try {
    const allSheets = (inst as unknown as { getAllSheets: () => Record<string, unknown>[] }).getAllSheets()
    const { activeSheetId } = useWorkbookStore.getState()
    const targetSheet = allSheets.find((s) => s.id === activeSheetId) ?? allSheets[0]
    if (!targetSheet) return

    const config = (targetSheet.config ?? {}) as { borderInfo?: unknown[] }
    const existing = (config.borderInfo ?? []) as unknown[]

    let nextBorderInfo: unknown[]
    if (preset === 'none') {
      // Remove any borderInfo entries that overlap with the selected range.
      // For simplicity, drop any entry whose range touches our selection.
      nextBorderInfo = existing.filter((entry) => {
        const e = entry as { range?: { row?: number[]; column?: number[] }[] }
        const r = e.range?.[0]
        if (!r || !r.row || !r.column) return true
        const overlapRow = r.row[0]! <= rows.end && r.row[1]! >= rows.start
        const overlapCol = r.column[0]! <= cols.end && r.column[1]! >= cols.start
        return !(overlapRow && overlapCol)
      })
    } else {
      nextBorderInfo = [
        ...existing,
        {
          rangeType: 'range',
          borderType: BORDER_TYPE_MAP[preset],
          style,
          color,
          range: [{ row: [rows.start, rows.end], column: [cols.start, cols.end] }],
        },
      ]
    }

    const nextSheet = {
      ...targetSheet,
      config: { ...config, borderInfo: nextBorderInfo },
    }
    const nextSheets = allSheets.map((s) => (s.id === targetSheet.id ? nextSheet : s))
    ;(inst as unknown as { updateSheet: (sheets: unknown[]) => void }).updateSheet(nextSheets)
    toast.success(preset === 'none' ? 'Borders cleared' : `${preset[0]!.toUpperCase()}${preset.slice(1)} border applied`)
  } catch (e) {
    toast.error(`Could not apply border: ${String(e)}`)
  }
}

/**
 * "Merge Across" — Excel parity.
 *
 * For an N-row × M-col selection, perform N independent merges, one
 * per row spanning columns start→end. The rows themselves stay
 * separate. Useful for header bands where each row of a multi-row
 * heading should be its own merged label.
 *
 * Different from "Merge Cells" which collapses the entire rectangle
 * into a single cell.
 */
export function mergeAcross(): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a range to merge across')
    return
  }
  if (cols.start === cols.end) {
    toast.message('Merge Across needs at least 2 columns')
    return
  }
  const { activeSheetId } = useWorkbookStore.getState()
  const mergeFn = (inst as unknown as {
    mergeCells?: (
      ranges: { row: [number, number]; column: [number, number] }[],
      type: string,
      opts?: { id?: string },
    ) => void
  }).mergeCells
  if (!mergeFn) {
    toast.error('Merge API not available')
    return
  }
  try {
    // One merge call per row so each row stays distinct.
    for (let r = rows.start; r <= rows.end; r++) {
      mergeFn(
        [{ row: [r, r], column: [cols.start, cols.end] }],
        'merge-all',
        { id: activeSheetId },
      )
    }
    const n = rows.end - rows.start + 1
    toast.success(`Merged ${n} row${n === 1 ? '' : 's'} across`)
  } catch (e) {
    toast.error(`Merge Across failed: ${String(e)}`)
  }
}
