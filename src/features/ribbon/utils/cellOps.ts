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
import { promptDialog } from '@/components/PromptDialog'
import { colIndexToLetter, selectionRows, selectionCols, getInstance } from './cellOps/shared'

// Re-export extracted cell ops so existing
// `import { … } from '@/features/ribbon/utils/cellOps'` call sites stay
// byte-identical after the Wave 4 split.
export {
  openNameManager,
  defineNameFromSelection,
  insertNameIntoFormula,
  createNamesFromSelection,
} from './cellOps/namedRanges'
export {
  setOrientationPreset,
  setMarginPreset,
  setPaperSizePreset,
  setPrintAreaFromSelection,
  clearPrintArea,
} from './cellOps/pageLayout'
export {
  applyBorder,
  mergeAcross,
  type BorderPreset,
  type BorderLineStyle,
} from './cellOps/borders'
export {
  freezeTopRow,
  freezeFirstColumn,
  freezePanesAtActiveCell,
  unfreezePanes,
  fillUp,
  fillLeft,
  fillDown,
  fillRight,
  fillSeries,
} from './cellOps/fillFreeze'
export {
  applyTablePalette,
  DEFAULT_TABLE_PALETTE,
} from './cellOps/excelTables'
export {
  startFormatPainter,
  type CapturedFormat,
} from './cellOps/formatPainter'
export {
  selectCellsWithFormulas,
  selectCellsWithComments,
  selectCellsWithConstants,
  selectCellsWithCF,
  selectCellsWithValidation,
} from './cellOps/selectMatching'

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
 * `₹#,##0.00;[Red]-₹#,##0.00` — which the canned NumberFormat presets
 * can't express. NOTE: lakh-style grouping (`#,##,##0`) is NOT supported —
 * FortuneSheet's bundled SSF throws on it (pinned by currencyMask.spec.ts);
 * the catch below surfaces a toast if a caller passes one.
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

export async function unhideSheetPicker(): Promise<void> {
  const wb = useWorkbookStore.getState()
  const hidden = wb.sheets.filter((s) => s.isHidden)
  if (hidden.length === 0) {
    toast.message('No hidden sheets')
    return
  }
  const labels = hidden.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
  const choice = await promptDialog({
    title: 'Unhide sheet',
    message: `Type the number of the sheet to unhide:\n${labels}`,
    defaultValue: '1',
    inputType: 'number',
  })
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

export async function insertHyperlink(): Promise<void> {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a cell first')
    return
  }

  const url = await promptDialog({
    title: 'Hyperlink address',
    message: 'A URL (https://…), a cell reference like Sheet1!A5, or mailto:foo@bar.com.',
    defaultValue: 'https://',
    inputType: 'url',
  })
  if (!url) return

  // Read existing display text or fall back to a sensible default
  const sheets = useSheetStore.getState().gridSheets
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = sheets.find((s) => s.id === activeSheetId)
  const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as
    | { v?: unknown; m?: unknown }
    | undefined
  const currentText = String(cell?.v ?? '')
  const text = await promptDialog({
    title: 'Display text',
    message: 'Leave blank to use the URL itself as the label.',
    defaultValue: currentText || url,
  })
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

// ─── Page Layout helpers ────────────────────────────────────────────────
// All wire into usePrintSettingsStore so File > Print and exportToPDF can
// honor the user's choices.

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

export async function goToDialog(): Promise<void> {
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const ref = await promptDialog({
    title: 'Go to cell or range',
    message: 'Examples: A1, B5:D10',
    defaultValue: 'A1',
  })
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
