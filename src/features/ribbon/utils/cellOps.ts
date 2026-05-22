'use client'

/**
 * Cell-level operations bound to FortuneSheet's instance API.
 *
 * Every helper here takes the current sheet state from useSheetStore +
 * useWorkbookStore and dispatches against gridInstance. They show toasts
 * on failure / completion so the user always sees something happen.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { WorkbookInstance } from '@fortune-sheet/react'

/** Read selection rows or fall back to the active cell's row. */
function selectionRows(): { start: number; end: number } | null {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) return null
  if (!selectedRange) return { start: selectedCell.row, end: selectedCell.row }
  return {
    start: Math.min(selectedRange.start.row, selectedRange.end.row),
    end: Math.max(selectedRange.start.row, selectedRange.end.row),
  }
}

function selectionCols(): { start: number; end: number } | null {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) return null
  if (!selectedRange) return { start: selectedCell.col, end: selectedCell.col }
  return {
    start: Math.min(selectedRange.start.col, selectedRange.end.col),
    end: Math.max(selectedRange.start.col, selectedRange.end.col),
  }
}

function getInstance(): WorkbookInstance | null {
  return useSheetStore.getState().gridInstance
}

// ─── Insert / Delete columns ─────────────────────────────────────────────

export function insertColumnLeft(): void {
  const inst = getInstance()
  const cols = selectionCols()
  if (!inst || !cols) {
    toast.message('Select a cell first')
    return
  }
  // Excel "Insert Column Left" inserts before the active column
  // FortuneSheet's insertRowOrColumn(type, index, count, direction) — direction
  // 'lefttop' inserts before the index, 'rightbottom' inserts after.
  try {
    ;(inst as unknown as {
      insertRowOrColumn: (type: 'row' | 'column', index: number, count: number, direction: 'lefttop' | 'rightbottom') => void
    }).insertRowOrColumn('column', cols.start, 1, 'lefttop')
    toast.success('Column inserted to the left')
  } catch (e) {
    toast.error(`Could not insert column: ${String(e)}`)
  }
}

export function insertColumnRight(): void {
  const inst = getInstance()
  const cols = selectionCols()
  if (!inst || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    ;(inst as unknown as {
      insertRowOrColumn: (type: 'row' | 'column', index: number, count: number, direction: 'lefttop' | 'rightbottom') => void
    }).insertRowOrColumn('column', cols.end, 1, 'rightbottom')
    toast.success('Column inserted to the right')
  } catch (e) {
    toast.error(`Could not insert column: ${String(e)}`)
  }
}

export function deleteColumn(): void {
  const inst = getInstance()
  const cols = selectionCols()
  if (!inst || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    ;(inst as unknown as {
      deleteRowOrColumn: (type: 'row' | 'column', startIndex: number, endIndex: number) => void
    }).deleteRowOrColumn('column', cols.start, cols.end)
    const count = cols.end - cols.start + 1
    toast.success(`${count} column${count > 1 ? 's' : ''} deleted`)
  } catch (e) {
    toast.error(`Could not delete column: ${String(e)}`)
  }
}

export function insertRowAbove(): void {
  const inst = getInstance()
  const rows = selectionRows()
  if (!inst || !rows) {
    toast.message('Select a cell first')
    return
  }
  try {
    ;(inst as unknown as {
      insertRowOrColumn: (type: 'row' | 'column', index: number, count: number, direction: 'lefttop' | 'rightbottom') => void
    }).insertRowOrColumn('row', rows.start, 1, 'lefttop')
    toast.success('Row inserted above')
  } catch (e) {
    toast.error(`Could not insert row: ${String(e)}`)
  }
}

// ─── Borders ─────────────────────────────────────────────────────────────

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

// ─── Merge Across (one merge per row of the selection) ─────────────────

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

// ─── Increase / Decrease Decimal ─────────────────────────────────────────

/**
 * Read the current cell's number-format string and add or remove one decimal
 * place. Mirrors Excel's behavior: General becomes 0.x or 0; "0.00" becomes
 * "0.000" (increase) or "0.0" (decrease) etc.
 */
function bumpDecimals(format: string, delta: 1 | -1): string {
  const trimmed = (format ?? 'General').trim()

  if (trimmed === '' || trimmed.toLowerCase() === 'general') {
    return delta > 0 ? '0.0' : '0'
  }

  // Find decimal portion: count trailing zeros after the first '.'
  const dotIdx = trimmed.indexOf('.')
  if (dotIdx === -1) {
    // No decimal yet
    if (delta > 0) return trimmed + '.0'
    return trimmed // Already integer, can't decrease further
  }

  // Count zeros after the dot until non-zero or end
  let zerosEnd = dotIdx + 1
  while (zerosEnd < trimmed.length && trimmed[zerosEnd] === '0') zerosEnd++

  const before = trimmed.slice(0, dotIdx + 1) // includes the '.'
  const zeros = trimmed.slice(dotIdx + 1, zerosEnd)
  const after = trimmed.slice(zerosEnd)

  if (delta > 0) {
    return before + zeros + '0' + after
  }

  // delta = -1
  if (zeros.length === 0) return trimmed
  if (zeros.length === 1) {
    // Removing the last zero — drop the dot too
    return trimmed.slice(0, dotIdx) + after
  }
  return before + zeros.slice(0, -1) + after
}

export function increaseDecimal(): void {
  bumpDecimalOnSelection(1)
}

export function decreaseDecimal(): void {
  bumpDecimalOnSelection(-1)
}

function bumpDecimalOnSelection(delta: 1 | -1): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    // Read the active cell's current format string
    const { selectedCell } = useSheetStore.getState()
    const allSheets = (inst as unknown as { getAllSheets: () => unknown[] }).getAllSheets()
    const { activeSheetId } = useWorkbookStore.getState()
    const sheet = (allSheets as { id: string; data?: { ct?: { fa?: string; t?: string } }[][] }[])
      .find((s) => s.id === activeSheetId) ?? allSheets[0] as { data?: { ct?: { fa?: string; t?: string } }[][] }
    const cell = sheet.data?.[selectedCell!.row]?.[selectedCell!.col]
    const currentFmt = cell?.ct?.fa ?? 'General'

    const nextFmt = bumpDecimals(currentFmt, delta)

    ;(inst as unknown as {
      setCellFormatByRange: (
        attr: string,
        value: unknown,
        range: { row: number[]; column: number[] }[],
      ) => void
    }).setCellFormatByRange(
      'ct',
      { fa: nextFmt, t: 'n' },
      [{ row: [rows.start, rows.end], column: [cols.start, cols.end] }],
    )
    toast.success(`Decimal places: ${countDecimals(nextFmt)}`)
  } catch (e) {
    toast.error(`Could not adjust decimals: ${String(e)}`)
  }
}

function countDecimals(format: string): number {
  const dotIdx = format.indexOf('.')
  if (dotIdx === -1) return 0
  let n = 0
  for (let i = dotIdx + 1; i < format.length && format[i] === '0'; i++) n++
  return n
}

/**
 * Apply an arbitrary Excel-style number format string to the selection.
 *
 * Used by the Currency-symbol dropdown to set non-preset formats like
 * `₹#,##,##0.00;[Red]-₹#,##,##0.00` (Indian Rupee with lakh-style
 * grouping) — which the canned NumberFormat presets can't express.
 *
 * Writes the format into FortuneSheet's `ct.fa` per-cell. Cell type
 * stays 'n' (numeric) so calculations keep working.
 */
export function applyCustomNumberFormat(format: string): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    const range = [{ row: [rows.start, rows.end], column: [cols.start, cols.end] }]
    ;(inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange('ct', { fa: format, t: 'n' }, range)
    toast.success('Format applied')
  } catch (e) {
    toast.error(`Could not apply format: ${String(e)}`)
  }
}

// ─── AutoSum operations (Average / Count / Max / Min) ───────────────────

export function applyAutoSumOp(op: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN'): void {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a cell first')
    return
  }
  try {
    const { row, col } = selectedCell
    const colLetter = colIndexToLetter(col)

    // Walk up from the active cell until we hit empty or non-numeric to find the range
    const allSheets = (inst as unknown as { getAllSheets: () => unknown[] }).getAllSheets()
    const { activeSheetId } = useWorkbookStore.getState()
    const sheet = (allSheets as { id: string; data?: { v?: unknown }[][] }[])
      .find((s) => s.id === activeSheetId) ?? allSheets[0] as { data?: { v?: unknown }[][] }
    const data = sheet.data ?? []

    let topRow = row - 1
    while (topRow >= 0) {
      const v = data[topRow]?.[col]?.v
      if (v === undefined || v === null || v === '') break
      if (op !== 'COUNT' && typeof v === 'string' && isNaN(Number(v))) break
      topRow--
    }
    topRow++

    if (topRow >= row) {
      // No range above; insert a placeholder formula
      ;(inst as unknown as { setCellValue: (r: number, c: number, v: string) => void })
        .setCellValue(row, col, `=${op}()`)
      toast.message(`Type the range inside =${op}(...)`)
      return
    }

    const formula = `=${op}(${colLetter}${topRow + 1}:${colLetter}${row})`
    ;(inst as unknown as { setCellValue: (r: number, c: number, v: string) => void })
      .setCellValue(row, col, formula)
    toast.success(`${op} applied`)
  } catch (e) {
    toast.error(`AutoSum failed: ${String(e)}`)
  }
}

function colIndexToLetter(index: number): string {
  let s = ''
  let n = index + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// ─── Clear ───────────────────────────────────────────────────────────────

export function clearContents(): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    for (let r = rows.start; r <= rows.end; r++) {
      for (let c = cols.start; c <= cols.end; c++) {
        ;(inst as unknown as { clearCell: (r: number, c: number) => void }).clearCell(r, c)
      }
    }
    toast.success('Contents cleared')
  } catch (e) {
    toast.error(`Could not clear contents: ${String(e)}`)
  }
}

export function clearAll(): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    // First clear values, then strip all formatting
    for (let r = rows.start; r <= rows.end; r++) {
      for (let c = cols.start; c <= cols.end; c++) {
        ;(inst as unknown as { clearCell: (r: number, c: number) => void }).clearCell(r, c)
      }
    }
    // Reset formatting on the range
    useSheetStore.getState().clearFormatOnSelection()
    toast.success('All cleared')
  } catch (e) {
    toast.error(`Could not clear all: ${String(e)}`)
  }
}

// ─── Clear Comments / Hyperlinks ────────────────────────────────────────

export function clearComments(): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    // FortuneSheet stores comments as `ps` attribute on the cell. Setting to null
    // via setCellFormatByRange clears them on each cell of the range.
    const range = [{ row: [rows.start, rows.end], column: [cols.start, cols.end] }]
    ;(inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange('ps', null, range)
    toast.success('Comments cleared')
  } catch (e) {
    toast.error(`Could not clear comments: ${String(e)}`)
  }
}

export function clearHyperlinks(): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    // FortuneSheet hyperlinks live on `hyperlink` attribute. Same approach.
    const range = [{ row: [rows.start, rows.end], column: [cols.start, cols.end] }]
    ;(inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange('hyperlink', null, range)
    toast.success('Hyperlinks cleared')
  } catch (e) {
    toast.error(`Could not clear hyperlinks: ${String(e)}`)
  }
}

// ─── Indent +/- ─────────────────────────────────────────────────────────
//
// FortuneSheet doesn't expose a native `alignment.indent` attribute the
// way Excel's OOXML does. We approximate by:
//
//   1. Tracking the indent level per cell on a custom property `qsIndent`
//      (0..15). The raw value `v` and formula `f` are NEVER mutated, so
//      sort + edit see the value as the user typed it.
//   2. Applying the visual indent through the display string `m`, which
//      is what FortuneSheet's canvas renderer reads. The display is
//      rebuilt deterministically from `qsIndent` + raw value, so
//      bumping indent twice doesn't compound spaces incorrectly.
//
// Improvements over the previous "count leading spaces in m" hack:
//   - Edit input no longer shows the padding spaces (we keep `v` clean)
//   - Sort uses the raw value, ignoring indent
//   - User-typed leading spaces in their own data aren't confused with
//     the indent level
//   - Indent level is queryable for future Excel xlsx round-trip
//
// Limitations: Spaces still appear in CSV/TSV export of display text;
// true xlsx round-trip needs FortuneSheet to expose alignment.indent.

const INDENT_SPACES_PER_LEVEL = 4
const MAX_INDENT_LEVEL = 15

export function increaseIndent(): void {
  bumpIndent(1)
}
export function decreaseIndent(): void {
  bumpIndent(-1)
}

function bumpIndent(delta: 1 | -1): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    const sheets = useSheetStore.getState().gridSheets
    const { activeSheetId } = useWorkbookStore.getState()
    const sheet = sheets.find((s) => s.id === activeSheetId)
    if (!sheet) return

    type IndentableCell = {
      v?: unknown
      m?: string
      f?: string
      qsIndent?: number
    }
    const setFmt = (inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange

    for (let r = rows.start; r <= rows.end; r++) {
      for (let c = cols.start; c <= cols.end; c++) {
        const cell = sheet.data?.[r]?.[c] as IndentableCell | undefined
        if (!cell) continue
        // Formulas keep `m` engine-managed — don't fight that.
        if (cell.f) continue

        const currentLevel = typeof cell.qsIndent === 'number' ? cell.qsIndent : 0
        const nextLevel = Math.min(MAX_INDENT_LEVEL, Math.max(0, currentLevel + delta))
        if (nextLevel === currentLevel) continue

        // Rebuild display from the raw value so we never compound spaces.
        const rawText = cell.v == null ? '' : String(cell.v)
        const display = ' '.repeat(nextLevel * INDENT_SPACES_PER_LEVEL) + rawText

        const range = [{ row: [r, r], column: [c, c] }]
        setFmt('qsIndent', nextLevel, range)
        setFmt('m', display, range)
      }
    }
    toast.success(delta > 0 ? 'Indent increased' : 'Indent decreased')
  } catch (e) {
    toast.error(`Could not adjust indent: ${String(e)}`)
  }
}

// ─── Orientation (text rotation) ────────────────────────────────────────

export type OrientationPreset = 0 | 90 | -90 | 45 | -45 | 'vertical'

export function applyOrientation(preset: OrientationPreset): void {
  const inst = getInstance()
  const rows = selectionRows()
  const cols = selectionCols()
  if (!inst || !rows || !cols) {
    toast.message('Select a cell first')
    return
  }
  try {
    const range = [{ row: [rows.start, rows.end], column: [cols.start, cols.end] }]
    if (preset === 'vertical') {
      // FortuneSheet uses `tr` = '1' for vertical text
      ;(inst as unknown as {
        setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
      }).setCellFormatByRange('tr', '1', range)
    } else {
      // Numeric rotation: FortuneSheet stores as string degrees in `tr`
      ;(inst as unknown as {
        setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
      }).setCellFormatByRange('tr', preset === 0 ? '0' : String(preset), range)
    }
    toast.success(`Orientation: ${preset === 0 ? 'horizontal' : preset === 'vertical' ? 'vertical' : preset + '°'}`)
  } catch (e) {
    toast.error(`Could not apply orientation: ${String(e)}`)
  }
}

// ─── Format Painter ─────────────────────────────────────────────────────
// Captures the active cell's full format object, then applies it to the next
// cell/range the user clicks on. We persist the captured format in a module-
// level variable so the click-handler installed by enable() can find it.

interface CapturedFormat {
  bg?: string
  fc?: string
  bl?: 0 | 1
  it?: 0 | 1
  un?: 0 | 1
  cl?: 0 | 1
  fs?: number
  ff?: string
  ht?: number
  vt?: number
  tb?: string
  ct?: { fa: string; t: 'n' | 's' } | null
  tr?: string
}

let painterArmed: { format: CapturedFormat; cleanup: () => void } | null = null

export function startFormatPainter(): void {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a source cell first, then click Format Painter')
    return
  }
  // Capture format from the current cell
  const sheets = useSheetStore.getState().gridSheets
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = sheets.find((s) => s.id === activeSheetId)
  const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as Record<string, unknown> | undefined
  if (!cell) {
    toast.message('Selected cell has no formatting to copy')
    return
  }
  const captured: CapturedFormat = {}
  for (const key of ['bg','fc','bl','it','un','cl','fs','ff','ht','vt','tb','ct','tr'] as const) {
    if (cell[key] !== undefined) (captured as Record<string, unknown>)[key] = cell[key]
  }

  if (painterArmed) painterArmed.cleanup()

  // Show a visual cue (cursor changes)
  document.body.classList.add('quiksheets-format-painter-active')

  function handleClickArm(_e: MouseEvent) {
    // Wait one tick so the new selection has propagated, then apply
    setTimeout(() => {
      const inst2 = useSheetStore.getState().gridInstance
      const next = useSheetStore.getState().selectedCell
      const range = useSheetStore.getState().selectedRange
      if (!inst2 || !next) {
        cleanup()
        return
      }
      const sr = range ? Math.min(range.start.row, range.end.row) : next.row
      const er = range ? Math.max(range.start.row, range.end.row) : next.row
      const sc = range ? Math.min(range.start.col, range.end.col) : next.col
      const ec = range ? Math.max(range.start.col, range.end.col) : next.col
      const targetRange = [{ row: [sr, er], column: [sc, ec] }]
      try {
        for (const [attr, value] of Object.entries(captured)) {
          ;(inst2 as unknown as {
            setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
          }).setCellFormatByRange(attr, value, targetRange)
        }
        toast.success('Format applied')
      } catch (e) {
        toast.error(`Format paint failed: ${String(e)}`)
      }
      cleanup()
    }, 50)
  }

  function cleanup() {
    document.body.classList.remove('quiksheets-format-painter-active')
    document.removeEventListener('mousedown', handleClickArm, true)
    painterArmed = null
  }

  document.addEventListener('mousedown', handleClickArm, true)
  painterArmed = { format: captured, cleanup }
  toast('Format Painter armed', { description: 'Click a cell or range to apply the copied format.' })
}

// ─── Reapply / Clear Filter ─────────────────────────────────────────────

export function clearFilter(): void {
  try {
    const { clearFilters } = useSheetStore.getState()
    clearFilters()
    toast.success('Filter cleared')
  } catch (e) {
    toast.error(`Could not clear filter: ${String(e)}`)
  }
}

export function reapplyFilter(): void {
  try {
    const state = useSheetStore.getState()
    const { activeFilters, setActiveFilters } = state
    if (activeFilters.length === 0) {
      toast.message('No filter to reapply')
      return
    }
    // setActiveFilters([...activeFilters]) re-runs computeHiddenRows on current data
    setActiveFilters([...activeFilters])
    toast.success(`Filter reapplied (${activeFilters.length} rule${activeFilters.length === 1 ? '' : 's'})`)
  } catch (e) {
    toast.error(`Could not reapply filter: ${String(e)}`)
  }
}

// ─── Freeze Panes ────────────────────────────────────────────────────────
// FortuneSheet API: freeze(type: 'row'|'column'|'both', range: {row, column}, options?)
//   type='row',    range={row:1, column:0} → freeze top row only
//   type='column', range={row:0, column:1} → freeze first column only
//   type='both',   range={row:R, column:C} → freeze rows 0..R-1 AND cols 0..C-1

type FreezeFn = (
  type: 'row' | 'column' | 'both',
  range: { row: number; column: number },
  options?: { id?: string },
) => void

export function freezeTopRow(): void {
  const inst = getInstance()
  if (!inst) { toast.error('Grid not ready'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    ;(inst as unknown as { freeze: FreezeFn }).freeze('row', { row: 1, column: 0 }, { id: activeSheetId })
    toast.success('Top row frozen')
  } catch (e) {
    toast.error(`Couldn't freeze: ${String(e)}`)
  }
}

export function freezeFirstColumn(): void {
  const inst = getInstance()
  if (!inst) { toast.error('Grid not ready'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    ;(inst as unknown as { freeze: FreezeFn }).freeze('column', { row: 0, column: 1 }, { id: activeSheetId })
    toast.success('First column frozen')
  } catch (e) {
    toast.error(`Couldn't freeze: ${String(e)}`)
  }
}

export function freezePanesAtActiveCell(): void {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) { toast.error('Select a cell first'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  // If active cell is A1, treat as freeze top-row (Excel default behaviour)
  if (selectedCell.row === 0 && selectedCell.col === 0) {
    return freezeTopRow()
  }
  try {
    ;(inst as unknown as { freeze: FreezeFn }).freeze(
      'both',
      { row: selectedCell.row, column: selectedCell.col },
      { id: activeSheetId },
    )
    toast.success(`Frozen at row ${selectedCell.row + 1}, column ${selectedCell.col + 1}`)
  } catch (e) {
    toast.error(`Couldn't freeze: ${String(e)}`)
  }
}

export function unfreezePanes(): void {
  const inst = getInstance()
  if (!inst) { toast.error('Grid not ready'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    // Setting row=0,column=0 unfreezes
    ;(inst as unknown as { freeze: FreezeFn }).freeze('row', { row: 0, column: 0 }, { id: activeSheetId })
    toast.success('Panes unfrozen')
  } catch (e) {
    toast.error(`Couldn't unfreeze: ${String(e)}`)
  }
}

// ─── Hide / Show Sheet ───────────────────────────────────────────────────

export function hideActiveSheet(): void {
  const wb = useWorkbookStore.getState()
  if (wb.sheets.filter((s) => !s.isHidden).length <= 1) {
    toast.error('Cannot hide the only visible sheet')
    return
  }
  wb.hideSheet(wb.activeSheetId)
  toast.success('Sheet hidden')
}

export function unhideSheetPicker(): void {
  const wb = useWorkbookStore.getState()
  const hidden = wb.sheets.filter((s) => s.isHidden)
  if (hidden.length === 0) {
    toast.message('No hidden sheets')
    return
  }
  const labels = hidden.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
  const choice = window.prompt(`Unhide which sheet?\n${labels}`, '1')
  if (!choice) return
  const idx = parseInt(choice, 10) - 1
  const target = hidden[idx]
  if (!target) {
    toast.error('Invalid choice')
    return
  }
  wb.hideSheet(target.id) // toggle
  toast.success(`"${target.name}" unhidden`)
}

// ─── Hyperlinks (Ctrl+K equivalent / Insert > Link) ─────────────────────
// FortuneSheet stores hyperlinks via the `hyperlink` cell attribute. We use a
// 2-prompt flow: first the URL (or cell ref / email), then optional display
// text. Empty display text falls back to the URL.

export function insertHyperlink(): void {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a cell first')
    return
  }

  const url = window.prompt(
    'Hyperlink address (URL, cell reference like "Sheet1!A5", or email "mailto:foo@bar.com"):',
    'https://',
  )
  if (!url) return

  // Read existing display text or fall back to a sensible default
  const sheets = useSheetStore.getState().gridSheets
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = sheets.find((s) => s.id === activeSheetId)
  const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as
    | { v?: unknown; m?: unknown }
    | undefined
  const currentText = String(cell?.v ?? '')
  const text = window.prompt('Display text (leave blank to use the URL):', currentText || url)
  if (text === null) return

  const displayText = text.trim() === '' ? url : text

  try {
    const range = [{ row: [selectedCell.row, selectedCell.row], column: [selectedCell.col, selectedCell.col] }]
    // Set the cell display text to the hyperlink label
    ;(inst as unknown as { setCellValue: (r: number, c: number, v: string) => void })
      .setCellValue(selectedCell.row, selectedCell.col, displayText)
    // Attach the hyperlink data
    ;(inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange(
      'hyperlink',
      { link: url, type: url.startsWith('mailto:') ? 'email' : url.includes('!') ? 'internal' : 'external' },
      range,
    )
    // Style as Excel hyperlinks: blue + underlined
    const blueRange = [{ row: [selectedCell.row, selectedCell.row], column: [selectedCell.col, selectedCell.col] }]
    ;(inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange('fc', '#0563C1', blueRange)
    ;(inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }).setCellFormatByRange('un', 1, blueRange)
    toast.success(`Hyperlink: ${url}`)
  } catch (e) {
    toast.error(`Could not insert hyperlink: ${String(e)}`)
  }
}

// ─── Fill variants (Up / Left / Series) ──────────────────────────────────
// Mirrors fillDown / fillRight from useExcelKeyboardShortcuts but flipped.

function fillFromBoundary(direction: 'up' | 'left'): void {
  const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range with the source at the bottom (Up) or right (Left)')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  const sheet = gridSheets[selectedCell.sheet]
  if (!sheet) return

  try {
    if (direction === 'up') {
      for (let c = sc; c <= ec; c++) {
        const sourceCell = sheet.data?.[er]?.[c] as { v?: unknown; f?: string } | undefined
        if (!sourceCell) continue
        const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
        for (let r = sr; r < er; r++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, source as unknown)
        }
      }
      toast.success('Filled up')
    } else {
      for (let r = sr; r <= er; r++) {
        const sourceCell = sheet.data?.[r]?.[ec] as { v?: unknown; f?: string } | undefined
        if (!sourceCell) continue
        const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
        for (let c = sc; c < ec; c++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, source as unknown)
        }
      }
      toast.success('Filled left')
    }
  } catch (e) {
    toast.error(`Fill failed: ${String(e)}`)
  }
}

export function fillUp(): void {
  fillFromBoundary('up')
}
export function fillLeft(): void {
  fillFromBoundary('left')
}

/** Fill Down — copy top row of selection into all rows below. */
export function fillDown(): void {
  const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range first')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  const sheet = gridSheets[selectedCell.sheet]
  if (!sheet) return
  try {
    for (let c = sc; c <= ec; c++) {
      const sourceCell = sheet.data?.[sr]?.[c] as { v?: unknown; f?: string } | undefined
      if (!sourceCell) continue
      const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
      for (let r = sr + 1; r <= er; r++) {
        ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
          .setCellValue(r, c, source as unknown)
      }
    }
    toast.success('Filled down')
  } catch (e) {
    toast.error(`Fill Down failed: ${String(e)}`)
  }
}

/** Fill Right — copy leftmost column of selection rightward. */
export function fillRight(): void {
  const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range first')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  const sheet = gridSheets[selectedCell.sheet]
  if (!sheet) return
  try {
    for (let r = sr; r <= er; r++) {
      const sourceCell = sheet.data?.[r]?.[sc] as { v?: unknown; f?: string } | undefined
      if (!sourceCell) continue
      const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
      for (let c = sc + 1; c <= ec; c++) {
        ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
          .setCellValue(r, c, source as unknown)
      }
    }
    toast.success('Filled right')
  } catch (e) {
    toast.error(`Fill Right failed: ${String(e)}`)
  }
}

/**
 * Fill Series — Excel's "Series…" dialog with start/step/stop. Simplified to
 * a 3-prompt flow (start value, step, stop). Generates an arithmetic series
 * down or right depending on selection orientation.
 */
export function fillSeries(): void {
  const { selectedCell, selectedRange, gridInstance } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range first')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)

  const startInput = window.prompt('Start value:', '1')
  if (startInput === null) return
  const stepInput = window.prompt('Step:', '1')
  if (stepInput === null) return
  const start = Number(startInput)
  const step = Number(stepInput)
  if (!Number.isFinite(start) || !Number.isFinite(step)) {
    toast.error('Enter valid numbers')
    return
  }

  try {
    if (er - sr >= ec - sc) {
      // Vertical orientation: fill down through the column(s)
      for (let c = sc; c <= ec; c++) {
        let v = start
        for (let r = sr; r <= er; r++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, v)
          v += step
        }
      }
    } else {
      // Horizontal: fill right
      for (let r = sr; r <= er; r++) {
        let v = start
        for (let c = sc; c <= ec; c++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, v)
          v += step
        }
      }
    }
    toast.success(`Series: ${start}, ${start + step}, ${start + 2 * step}…`)
  } catch (e) {
    toast.error(`Series fill failed: ${String(e)}`)
  }
}

// ─── Find & Select submenu (Excel-faithful) ────────────────────────────
// Each of these walks the active sheet and selects all cells that match a
// criterion: formulas, comments, conditional formatting, constants, or
// validation. Mirrors Excel's Home > Find & Select > Go To Special variants.

type CellTest = (cell: Record<string, unknown> | null | undefined, r: number, c: number) => boolean

function selectMatchingCells(label: string, test: CellTest): void {
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const { gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) {
    toast.error('Active sheet not found')
    return
  }

  const matches: Array<{ row: number[]; column: number[] }> = []
  const data = sheet.data ?? []
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] as Record<string, unknown> | null | undefined
      if (test(cell, r, c)) matches.push({ row: [r, r], column: [c, c] })
    }
  }

  if (matches.length === 0) {
    toast.message(`No cells with ${label.toLowerCase()}`)
    return
  }

  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(matches, { id: activeSheetId })
    toast.success(`Selected ${matches.length} cell${matches.length === 1 ? '' : 's'} with ${label.toLowerCase()}`)
  } catch (e) {
    toast.error(`Could not select: ${String(e)}`)
  }
}

export function selectCellsWithFormulas(): void {
  selectMatchingCells('Formulas', (cell) => !!cell && typeof cell.f === 'string' && cell.f !== '')
}

export function selectCellsWithComments(): void {
  selectMatchingCells('Comments', (cell) => !!cell && cell.ps != null)
}

export function selectCellsWithConstants(): void {
  selectMatchingCells(
    'Constants',
    (cell) => !!cell && cell.v != null && cell.v !== '' && !cell.f,
  )
}

export function selectCellsWithCF(): void {
  // Cross-reference the active sheet's CF rules. Cells inside any rule's range qualify.
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const { activeSheetId } = useWorkbookStore.getState()
  // Lazy-import to avoid circular dependency at module load time
  type CFStore = {
    getRulesForSheet: (sheetId: string) => Array<{ range: string }>
  }
  let cfStore: CFStore | null = null
  try {
    const debugWindow = (typeof window !== 'undefined'
      ? (window as Window & { __quiksheetsDebug?: { cf: () => CFStore } })
      : null)
    cfStore = debugWindow?.__quiksheetsDebug?.cf?.() ?? null
  } catch {
    cfStore = null
  }
  if (!cfStore) {
    toast.message('Conditional formatting store not yet loaded')
    return
  }
  const rules = cfStore.getRulesForSheet(activeSheetId)
  if (rules.length === 0) {
    toast.message('No conditional formatting rules on this sheet')
    return
  }

  function colLetterToIndex(letter: string): number {
    let result = 0
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64)
    }
    return result - 1
  }

  const selections: Array<{ row: number[]; column: number[] }> = []
  for (const rule of rules) {
    const m = rule.range.toUpperCase().match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)
    if (!m) continue
    const sc = colLetterToIndex(m[1]!)
    const sr = parseInt(m[2]!, 10) - 1
    const ec = m[3] ? colLetterToIndex(m[3]) : sc
    const er = m[4] ? parseInt(m[4]!, 10) - 1 : sr
    selections.push({ row: [sr, er], column: [sc, ec] })
  }

  if (selections.length === 0) {
    toast.message('Could not parse CF ranges')
    return
  }

  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(selections, { id: activeSheetId })
    toast.success(`Selected ${selections.length} CF range${selections.length === 1 ? '' : 's'}`)
  } catch (e) {
    toast.error(`Could not select: ${String(e)}`)
  }
}

export function selectCellsWithValidation(): void {
  const { validationRules } = useSheetStore.getState()
  const keys = Object.keys(validationRules ?? {})
  if (keys.length === 0) {
    toast.message('No data validation rules')
    return
  }

  const inst = getInstance()
  if (!inst) return
  const { activeSheetId } = useWorkbookStore.getState()
  const selections: Array<{ row: number[]; column: number[] }> = keys
    .map((key) => {
      const [r, c] = key.split(':').map((s) => parseInt(s, 10))
      return Number.isFinite(r) && Number.isFinite(c)
        ? { row: [r!, r!], column: [c!, c!] }
        : null
    })
    .filter((x): x is { row: number[]; column: number[] } => x !== null)

  if (selections.length === 0) return

  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(selections, { id: activeSheetId })
    toast.success(`Selected ${selections.length} cell${selections.length === 1 ? '' : 's'} with validation`)
  } catch (e) {
    toast.error(`Could not select: ${String(e)}`)
  }
}

// ─── Formula Auditing ───────────────────────────────────────────────────

/**
 * Show / hide formulas in cells. When on, every formula cell displays its
 * formula text instead of the computed value. Toggleable via Ctrl+` or the
 * Formulas tab > Show Formulas button.
 *
 * Implementation walks the active sheet and patches each formula cell's `m`
 * (display) field: backing it up before showing the formula, restoring on
 * toggle off.
 */
let showFormulasBackup: Map<string, string | undefined> | null = null

export function toggleShowFormulas(): void {
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const { gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) return

  const turningOn = showFormulasBackup === null
  if (turningOn) {
    showFormulasBackup = new Map()
  }

  try {
    const data = sheet.data ?? []
    for (let r = 0; r < data.length; r++) {
      const row = data[r] ?? []
      for (let c = 0; c < row.length; c++) {
        const cell = row[c] as { f?: string; m?: string; v?: unknown } | undefined
        if (!cell?.f) continue
        const key = `${r}:${c}`
        if (turningOn) {
          // Back up the current display, replace with formula text
          showFormulasBackup!.set(key, cell.m)
          ;(inst as unknown as {
            setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
          }).setCellFormatByRange('m', `=${cell.f}`, [{ row: [r, r], column: [c, c] }])
        } else {
          // Restore the original display
          const orig = showFormulasBackup?.get(key)
          ;(inst as unknown as {
            setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
          }).setCellFormatByRange('m', orig ?? String(cell.v ?? ''), [{ row: [r, r], column: [c, c] }])
        }
      }
    }
    if (!turningOn) showFormulasBackup = null
    toast.success(turningOn ? 'Showing formulas' : 'Showing values')
  } catch (e) {
    toast.error(`Toggle failed: ${String(e)}`)
  }
}

/**
 * Open the Dependency Map (our equivalent of Trace Precedents/Dependents).
 * The map already visualizes formula dependencies as a graph; this just opens
 * it. Excel's behavior of "draw arrows over the canvas" would need a custom
 * SVG overlay; the map view is functionally equivalent.
 */
export function openDependencyMap(): void {
  // Lazy-import sheet page's toggleMap callback via a custom DOM event.
  // The sheet page listens for 'quiksheets:toggle-map' and toggles the map.
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('quiksheets:toggle-map'))
  toast.success('Dependency Map opened — drag/zoom to explore precedents and dependents')
}

/**
 * Find cells with error values (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?,
 * #NUM!, #NULL!) and select all of them at once. Mirrors Excel's Error
 * Checking flow for visual scanning.
 */
const ERROR_PATTERN = /^#(REF|DIV\/0|VALUE|N\/A|NAME|NUM|NULL)[!?]/

export function runErrorChecking(): void {
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const { gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) return

  const errorCells: Array<{ row: number[]; column: number[] }> = []
  const data = sheet.data ?? []
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] as { v?: unknown; m?: string } | undefined
      if (!cell) continue
      const display = String(cell.m ?? cell.v ?? '')
      if (ERROR_PATTERN.test(display)) {
        errorCells.push({ row: [r, r], column: [c, c] })
      }
    }
  }

  if (errorCells.length === 0) {
    toast.success('No formula errors found')
    return
  }
  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(errorCells, { id: activeSheetId })
    toast.success(`Found ${errorCells.length} error cell${errorCells.length === 1 ? '' : 's'}`)
  } catch (e) {
    toast.error(`Could not select error cells: ${String(e)}`)
  }
}

/**
 * Evaluate Formula — shows the resolved value of the active cell's formula
 * step by step. Simple version: shows the formula + its evaluated result in
 * a toast. Excel's full stepper is a deeper feature.
 */
export function evaluateFormula(): void {
  const { selectedCell, gridSheets } = useSheetStore.getState()
  if (!selectedCell) {
    toast.message('Select a cell with a formula')
    return
  }
  const sheet = gridSheets[selectedCell.sheet]
  const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as
    | { f?: string; v?: unknown }
    | undefined
  if (!cell?.f) {
    toast.message('Selected cell has no formula')
    return
  }
  const result = cell.v
  toast(`= ${cell.f}`, {
    description: `Result: ${String(result ?? '(empty)')}`,
    duration: 8000,
  })
}

// ─── Defined Names (Ctrl+F3) ────────────────────────────────────────────

import { useNamedRangesStore, validateNamedRangeName } from '@/features/named-ranges/namedRangesStore'

/**
 * Open the Name Manager dialog. Idempotent.
 */
export function openNameManager(): void {
  useNamedRangesStore.getState().setDialogOpen(true)
}

/**
 * Define a new name from the current selection (prompt-based).
 */
export function defineNameFromSelection(workbookId: string): void {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) {
    toast.error('Select a range first')
    return
  }
  const sr = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const er = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const sc = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const ec = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const range = `${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`

  const name = window.prompt('Define a name for this range:', '')
  if (!name) return
  const v = validateNamedRangeName(name)
  if (!v.ok) {
    toast.error(v.error ?? 'Invalid name')
    return
  }
  useNamedRangesStore.getState().addName(workbookId, {
    name,
    range,
    scope: 'workbook',
  })
  toast.success(`Defined "${name}" → ${range}`)
}

/**
 * Show a list of names; clicking one inserts its RANGE (not the name) into
 * the formula bar at the active cell. We insert the resolved range because
 * formulajs (the engine FortuneSheet uses) doesn't natively support named
 * range substitution — the foundation is here for a future iter to plumb that
 * through the evaluator.
 */
export function insertNameIntoFormula(workbookId: string): void {
  const names = useNamedRangesStore.getState().getNamesForWorkbook(workbookId)
  if (names.length === 0) {
    toast.message('No defined names. Open Name Manager (Ctrl+F3) to add one.')
    return
  }
  const labels = names.map((n, i) => `${i + 1}. ${n.name} = ${n.range}`).join('\n')
  const choice = window.prompt(`Pick a name:\n${labels}`, '1')
  if (!choice) return
  const idx = parseInt(choice, 10) - 1
  const target = names[idx]
  if (!target) {
    toast.error('Invalid choice')
    return
  }
  const { setFormulaBarValue, setEditingCell, selectedCell, formulaBarValue } = useSheetStore.getState()
  // Append the range to whatever's already in the bar
  const next = (formulaBarValue ?? '') + target.range
  setFormulaBarValue(next)
  if (selectedCell) setEditingCell(selectedCell)
}

/**
 * Walks the active sheet's selected range. If row 1 has headers, creates a name
 * for each column with the header-as-name and the rest of the column as range.
 * Mirrors Excel's "Create from Selection" with "Top row" option.
 */
export function createNamesFromSelection(workbookId: string): void {
  const { selectedCell, selectedRange, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange) {
    toast.error('Select a range with headers')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  if (er === sr) {
    toast.error('Selection must include header row + at least one data row')
    return
  }

  const sheet = gridSheets[selectedCell.sheet]
  if (!sheet) return
  const matrix = sheet.data
  if (!matrix) return

  let added = 0
  let skipped = 0
  for (let c = sc; c <= ec; c++) {
    const headerCell = matrix[sr]?.[c] as { v?: unknown } | undefined
    const header = String(headerCell?.v ?? '').trim()
    if (!header) {
      skipped++
      continue
    }
    // Sanitize: replace spaces with underscores; reject if still invalid
    const sanitized = header.replace(/\s+/g, '_')
    const v = validateNamedRangeName(sanitized)
    if (!v.ok) {
      skipped++
      continue
    }
    const range = `${colIndexToLetter(c)}${sr + 2}:${colIndexToLetter(c)}${er + 1}`
    useNamedRangesStore.getState().addName(workbookId, {
      name: sanitized,
      range,
      scope: 'workbook',
    })
    added++
  }
  toast.success(`Created ${added} name${added === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}`)
}

// ─── Page Layout helpers ────────────────────────────────────────────────
// All wire into usePrintSettingsStore so File > Print and exportToPDF can
// honor the user's choices.

import {
  usePrintSettingsStore,
  type Orientation,
  type MarginPreset,
  type PaperSize,
} from '@/features/page-layout/printSettingsStore'

export function setOrientationPreset(orientation: Orientation): void {
  usePrintSettingsStore.getState().setOrientation(orientation)
  toast.success(`Orientation: ${orientation === 'portrait' ? 'Portrait' : 'Landscape'}`)
}

export function setMarginPreset(preset: MarginPreset): void {
  if (preset === 'custom') {
    const top = window.prompt('Top margin (inches):', '0.75')
    if (top === null) return
    const right = window.prompt('Right margin (inches):', '0.7')
    if (right === null) return
    const bottom = window.prompt('Bottom margin (inches):', '0.75')
    if (bottom === null) return
    const left = window.prompt('Left margin (inches):', '0.7')
    if (left === null) return
    const margins = {
      top: parseFloat(top),
      right: parseFloat(right),
      bottom: parseFloat(bottom),
      left: parseFloat(left),
    }
    if (Object.values(margins).some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error('Enter valid non-negative numbers')
      return
    }
    usePrintSettingsStore.getState().setCustomMargins(margins)
    toast.success(`Custom margins applied`)
  } else {
    usePrintSettingsStore.getState().setMarginPreset(preset)
    toast.success(`Margins: ${preset.charAt(0).toUpperCase() + preset.slice(1)}`)
  }
}

export function setPaperSizePreset(size: PaperSize): void {
  usePrintSettingsStore.getState().setPaperSize(size)
  toast.success(`Paper size: ${size.toUpperCase()}`)
}

/** Set Print Area to the current selection (or current cell if no range). */
export function setPrintAreaFromSelection(): void {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) {
    toast.error('Select a range first')
    return
  }
  const sr = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const er = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const sc = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const ec = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const range = `${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`
  usePrintSettingsStore.getState().setPrintArea(range)
  toast.success(`Print area set to ${range}`)
}

export function clearPrintArea(): void {
  usePrintSettingsStore.getState().setPrintArea(null)
  toast.success('Print area cleared')
}

// ─── Excel Tables (Ctrl+T) ──────────────────────────────────────────────
// Mirrors Excel's "Format as Table" with the default Light Blue palette when
// invoked via Ctrl+T. The active selection becomes the table range; row 1 of
// that range gets header styling (blue bg, white bold text), body rows get
// alternating fill colors.

export const DEFAULT_TABLE_PALETTE = {
  name: 'Light Blue',
  bg: '#DDEBF7',
  header: '#5B9BD5',
  alt: '#FFFFFF',
} as const

interface TablePalette {
  bg: string
  header: string
  alt: string
}

/**
 * Build a table palette from the currently-active workbook theme so
 * Format-as-Table picks up the user's Themes / Colors / Fonts choice.
 * Lazy-loaded via dynamic import to avoid a circular module dep with
 * the themes feature.
 */
function paletteFromActiveTheme(): TablePalette {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/features/themes/store/themeStore') as {
      getActiveTheme(): { colors: { primary: string; accent: string; surface: string } }
    }
    const theme = mod.getActiveTheme()
    return {
      header: theme.colors.primary,
      bg:     theme.colors.accent,
      alt:    theme.colors.surface,
    }
  } catch {
    return DEFAULT_TABLE_PALETTE
  }
}

export function applyTablePalette(palette?: TablePalette): void {
  const resolvedPalette: TablePalette = palette ?? paletteFromActiveTheme()
  const inst = getInstance()
  const { selectedCell, selectedRange, applyFormatToSelection } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a range first')
    return
  }
  const r = selectedRange
  const sr = r ? Math.min(r.start.row, r.end.row) : selectedCell.row
  const er = r ? Math.max(r.start.row, r.end.row) : selectedCell.row
  const sc = r ? Math.min(r.start.col, r.end.col) : selectedCell.col
  const ec = r ? Math.max(r.start.col, r.end.col) : selectedCell.col

  if (sr === er && sc === ec) {
    toast.message('Select a multi-cell range to format as table')
    return
  }

  try {
    const gi = inst as unknown as {
      setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
    }
    // Header row
    gi.setCellFormatByRange('bg', resolvedPalette.header, [{ row: [sr, sr], column: [sc, ec] }])
    gi.setCellFormatByRange('fc', '#FFFFFF',              [{ row: [sr, sr], column: [sc, ec] }])
    gi.setCellFormatByRange('bl', 1,                       [{ row: [sr, sr], column: [sc, ec] }])
    // Body rows: alternate
    for (let row = sr + 1; row <= er; row += 1) {
      const bg = (row - sr) % 2 === 1 ? resolvedPalette.bg : resolvedPalette.alt
      gi.setCellFormatByRange('bg', bg, [{ row: [row, row], column: [sc, ec] }])
    }
    toast.success(`Table style applied to ${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`)
  } catch (e) {
    // Fallback for grids without the format API
    applyFormatToSelection({ backgroundColor: resolvedPalette.bg })
    toast.error(`Partial table format: ${String(e)}`)
  }
}

// ─── Hyperlink follow (Ctrl+Click) ───────────────────────────────────────
// Attaches a single document-level click handler that, when Ctrl/Cmd is held
// during a click, looks up the currently-selected cell and follows its
// hyperlink if present. Safe to call multiple times — installs once.

let hyperlinkFollowInstalled = false

export function installHyperlinkFollow(): void {
  if (hyperlinkFollowInstalled || typeof window === 'undefined') return
  hyperlinkFollowInstalled = true

  function handleClick(e: MouseEvent) {
    if (!(e.ctrlKey || e.metaKey)) return
    // Only react if the click is inside the FortuneSheet canvas area
    const target = e.target as HTMLElement | null
    if (!target?.closest('.luckysheet')) return

    // Wait one tick so FortuneSheet's own selection-change has propagated to our store
    setTimeout(() => {
      const { selectedCell, gridSheets } = useSheetStore.getState()
      const { activeSheetId } = useWorkbookStore.getState()
      if (!selectedCell) return
      const sheet = gridSheets.find((s) => s.id === activeSheetId)
      const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as
        | { hyperlink?: { link?: string } | string | null }
        | undefined
      const hl = cell?.hyperlink
      const url = typeof hl === 'string' ? hl : hl?.link
      if (!url) return
      try {
        // mailto: should open in same tab
        if (url.startsWith('mailto:')) {
          window.location.href = url
        } else {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
        toast.success(`Opened: ${url}`)
      } catch {
        toast.error('Could not open hyperlink')
      }
    }, 30)
  }

  document.addEventListener('click', handleClick, true)
}

// ─── Go To (cell address navigation) ────────────────────────────────────

export function goToDialog(): void {
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const ref = window.prompt('Go to cell or range (e.g., A1, B5:D10):', 'A1')
  if (!ref) return
  // Parse: support both single cell (A1) and range (A1:C5)
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)
  if (!m) {
    toast.error(`Invalid reference: ${ref}`)
    return
  }
  function colLetterToIndex(letter: string): number {
    let result = 0
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64)
    }
    return result - 1
  }
  const sc = colLetterToIndex(m[1]!)
  const sr = parseInt(m[2]!) - 1
  const ec = m[3] ? colLetterToIndex(m[3]) : sc
  const er = m[4] ? parseInt(m[4]) - 1 : sr
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection([{ row: [sr, er], column: [sc, ec] }], { id: activeSheetId })
    useSheetStore.getState().setSelectedCell({ row: sr, col: sc, sheet: 0 })
    toast.success(`Jumped to ${ref}`)
  } catch (e) {
    toast.error(`Go To failed: ${String(e)}`)
  }
}
