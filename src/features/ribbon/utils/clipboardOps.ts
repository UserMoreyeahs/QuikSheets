'use client'

/**
 * Modern clipboard operations for the Home tab Clipboard group.
 *
 * Replaces the old `document.execCommand('cut'|'copy')` calls (deprecated)
 * with the asynchronous `navigator.clipboard` API. Also implements the
 * Paste Special dropdown — six paste modes matching Excel's menu:
 *
 *   all          — default; values + formulas + styles + formats
 *   values       — strip formulas, keep evaluated values + display
 *   formulas     — keep formulas + values only (drop styling)
 *   formatting   — copy styles only, leave existing target values intact
 *   transpose    — swap rows<->cols on paste (default content + formulas)
 *   link         — paste cell references (=SourceSheet!A1) — values follow source
 *
 * Wire format we put on the system clipboard:
 *   - text/plain  : TSV (rows = "\n", cols = "\t") — for general-purpose paste
 *   - text/html   : minimal <table> with inline styles — preserves formatting
 *                   when pasted into Word/Email/Notion etc.
 *
 * We don't yet write the proprietary "Excel XML" payload, so pasting into
 * Excel itself will use the HTML path (works but loses cell formulas).
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { colIndexToLetter } from '@/lib/cellAddress'
import { getSheetMatrix } from '@/lib/fortuneSheet'
import type { Sheet } from '@fortune-sheet/core'

/** Modes that the Paste Special dropdown can request. */
export type PasteMode = 'all' | 'values' | 'formulas' | 'formatting' | 'transpose' | 'link'

interface CapturedCell {
  /** Raw value (number or string). */
  v: unknown
  /** Formula without leading '='. */
  f?: string
  /** Display text. */
  m?: string
  /** Style block — copied verbatim for "formatting" / "all" modes. */
  style?: Record<string, unknown>
}

interface CapturedRange {
  rows: CapturedCell[][]
  /** Origin of the copy — used only by Paste Link. */
  sourceSheetName: string
  sourceStartRow: number
  sourceStartCol: number
}

// ── module-state ─────────────────────────────────────────────────────────
// Last in-app copy/cut payload — preferred over text/plain clipboard when
// present so we keep formulas + styles intact for in-app round trips. The
// system clipboard text/HTML is still written so cross-app paste works.
let inAppClipboard: CapturedRange | null = null
let pendingCutClear: { sheetId: string; sr: number; sc: number; er: number; ec: number } | null = null

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

function getActiveSheet(): Sheet | null {
  const { gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  return gridSheets.find((s) => s.id === activeSheetId) ?? null
}

function getSelectedRange(): { sr: number; sc: number; er: number; ec: number } | null {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (selectedRange) {
    return {
      sr: Math.min(selectedRange.start.row, selectedRange.end.row),
      sc: Math.min(selectedRange.start.col, selectedRange.end.col),
      er: Math.max(selectedRange.start.row, selectedRange.end.row),
      ec: Math.max(selectedRange.start.col, selectedRange.end.col),
    }
  }
  if (selectedCell) {
    return { sr: selectedCell.row, sc: selectedCell.col, er: selectedCell.row, ec: selectedCell.col }
  }
  return null
}

/**
 * Walk a range in the active sheet, returning the per-cell payload.
 * Returns `null` when there's no selection or active sheet.
 */
function captureRange(): CapturedRange | null {
  const sheet = getActiveSheet()
  const rng = getSelectedRange()
  if (!sheet || !rng) return null

  const matrix = getSheetMatrix(sheet)
  const rows: CapturedCell[][] = []
  for (let r = rng.sr; r <= rng.er; r++) {
    const row: CapturedCell[] = []
    for (let c = rng.sc; c <= rng.ec; c++) {
      const raw = (matrix[r]?.[c] ?? null) as Record<string, unknown> | null
      const cell: CapturedCell = { v: raw?.v ?? null }
      if (typeof raw?.f === 'string') cell.f = raw.f
      if (typeof raw?.m === 'string') cell.m = raw.m
      // Copy style keys verbatim — these are the FortuneSheet cell-style
      // properties (bg, fc, bl, it, un, cl, fs, ff, ht, vt, tb, ct, tr).
      const style: Record<string, unknown> = {}
      for (const k of ['bg', 'fc', 'bl', 'it', 'un', 'cl', 'fs', 'ff', 'ht', 'vt', 'tb', 'ct', 'tr']) {
        if (raw?.[k] !== undefined) style[k] = raw[k]
      }
      if (Object.keys(style).length > 0) cell.style = style
      row.push(cell)
    }
    rows.push(row)
  }
  return {
    rows,
    sourceSheetName: sheet.name ?? 'Sheet1',
    sourceStartRow: rng.sr,
    sourceStartCol: rng.sc,
  }
}

/** Serialize a captured range as Tab-Separated Values (Excel-compatible). */
function toTSV(payload: CapturedRange): string {
  return payload.rows
    .map((row) =>
      row
        .map((c) => {
          // Prefer the display text so users pasting into other apps get
          // what they see, not the raw underlying number.
          const text = c.m ?? (c.v == null ? '' : String(c.v))
          // Escape embedded tabs / newlines (rare but possible).
          if (/[\t\n\r"]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`
          }
          return text
        })
        .join('\t'),
    )
    .join('\n')
}

/** Serialize a captured range as a minimal HTML <table> — enables rich paste. */
function toHTML(payload: CapturedRange): string {
  const rowsHtml = payload.rows
    .map((row) => {
      const cells = row
        .map((c) => {
          const text = (c.m ?? (c.v == null ? '' : String(c.v))).replace(/&/g, '&amp;').replace(/</g, '&lt;')
          const styles: string[] = []
          const st = c.style ?? {}
          if (typeof st.bg === 'string') styles.push(`background:${st.bg}`)
          if (typeof st.fc === 'string') styles.push(`color:${st.fc}`)
          if (st.bl === 1) styles.push('font-weight:bold')
          if (st.it === 1) styles.push('font-style:italic')
          if (st.un === 1) styles.push('text-decoration:underline')
          if (typeof st.fs === 'number') styles.push(`font-size:${st.fs}px`)
          const style = styles.length ? ` style="${styles.join(';')}"` : ''
          return `<td${style}>${text}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  return `<meta charset="utf-8"><table>${rowsHtml}</table>`
}

/** Parse a TSV string back into a 2D array of strings. */
function parseTSV(text: string): string[][] {
  // Split on LF/CRLF but respect quoted cells that may contain newlines.
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === '\t') {
      row.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      // Swallow LF after CR
      if (ch === '\r' && text[i + 1] === '\n') i++
      i++
      continue
    }
    cell += ch
    i++
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** Apply a single value/formula/style triple to the grid. */
function applyCell(
  inst: { setCellValue?: (r: number, c: number, v: unknown) => void; setCellFormat?: (r: number, c: number, attr: string, value: unknown) => void },
  row: number,
  col: number,
  cell: CapturedCell,
  mode: PasteMode,
): void {
  // 1) value / formula
  if (mode === 'all' || mode === 'values' || mode === 'transpose') {
    if (mode === 'values') {
      inst.setCellValue?.(row, col, cell.v as unknown)
    } else {
      // 'all' and 'transpose' preserve formulas
      inst.setCellValue?.(row, col, cell.f ? `=${cell.f}` : (cell.v as unknown))
    }
  } else if (mode === 'formulas') {
    inst.setCellValue?.(row, col, cell.f ? `=${cell.f}` : (cell.v as unknown))
  }
  // 2) style
  if ((mode === 'all' || mode === 'formatting' || mode === 'transpose') && cell.style) {
    for (const [k, v] of Object.entries(cell.style)) {
      try {
        inst.setCellFormat?.(row, col, k, v)
      } catch {
        // Some FortuneSheet builds expose setCellFormatByRange only —
        // best-effort; styles will still round-trip via the cell.v object
        // when we re-load.
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public API — wired into HomeTab buttons
// ─────────────────────────────────────────────────────────────────────────

/** Copy the current selection to the clipboard (modern API + in-app cache). */
export async function copySelection(): Promise<void> {
  const payload = captureRange()
  if (!payload) {
    toast.message('Select a cell or range to copy')
    return
  }
  inAppClipboard = payload
  pendingCutClear = null

  const text = toTSV(payload)
  const html = toHTML(payload)
  try {
    if (navigator.clipboard?.write && typeof window !== 'undefined' && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // Last-resort fallback for older browsers — execCommand still works
      // even though it's deprecated.
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    toast.success(`Copied ${payload.rows.length}×${payload.rows[0]?.length ?? 0}`)
  } catch (err) {
    toast.error('Copy failed — check browser permissions')
    // eslint-disable-next-line no-console
    console.debug('[clipboard] copy failed', err)
  }
}

/**
 * Cut the current selection. Behaviour: copy + remember the source range,
 * then clear the cells on the next paste (matching Excel's marching-ants
 * model rather than clearing immediately).
 */
export async function cutSelection(): Promise<void> {
  const rng = getSelectedRange()
  const sheet = getActiveSheet()
  await copySelection()
  if (rng && sheet && typeof sheet.id === 'string') {
    pendingCutClear = { sheetId: sheet.id, ...rng }
    toast.message('Cut — paste anywhere to move')
  }
}

/**
 * Paste from the clipboard into the active cell with the requested mode.
 *
 * Preference order:
 *   1. In-app captured range (preserves formulas + styles for in-app copies)
 *   2. System clipboard text/plain TSV
 *
 * After a successful paste, if there's a pending cut-clear, wipe the source.
 */
export async function pasteFromClipboard(mode: PasteMode = 'all'): Promise<void> {
  const { gridInstance } = useSheetStore.getState()
  const dest = getSelectedRange()
  if (!gridInstance || !dest) {
    toast.message('Select a destination cell first')
    return
  }
  const inst = gridInstance as unknown as {
    setCellValue?: (r: number, c: number, v: unknown) => void
    setCellFormat?: (r: number, c: number, attr: string, value: unknown) => void
  }

  // ── Paste Link (special-case) ──
  // Writes formulas that point at the source range cells. Requires the
  // in-app clipboard (system clipboard doesn't carry sheet name + coords).
  if (mode === 'link') {
    if (!inAppClipboard) {
      toast.message('Paste Link requires copying within Quiksheets first')
      return
    }
    const src = inAppClipboard
    for (let r = 0; r < src.rows.length; r++) {
      for (let c = 0; c < (src.rows[r]?.length ?? 0); c++) {
        const sr = src.sourceStartRow + r
        const sc = src.sourceStartCol + c
        const ref = `=${src.sourceSheetName}!${colIndexToLetter(sc)}${sr + 1}`
        inst.setCellValue?.(dest.sr + r, dest.sc + c, ref)
      }
    }
    toast.success('Pasted as link')
    return
  }

  // ── Resolve source payload ──
  let payload: CapturedRange | null = inAppClipboard
  if (!payload) {
    // Pull plain text from the system clipboard and synthesise a payload.
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch (err) {
      toast.error('Paste failed — clipboard read permission denied')
      // eslint-disable-next-line no-console
      console.debug('[clipboard] readText failed', err)
      return
    }
    if (!text) {
      toast.message('Clipboard is empty')
      return
    }
    const rows = parseTSV(text).map((row) => row.map((v) => ({ v }) as CapturedCell))
    payload = {
      rows,
      sourceSheetName: '',
      sourceStartRow: 0,
      sourceStartCol: 0,
    }
  }

  // ── Apply ──
  if (mode === 'transpose') {
    const rows = payload.rows
    const transposed: CapturedCell[][] = []
    const w = rows[0]?.length ?? 0
    for (let c = 0; c < w; c++) {
      const newRow: CapturedCell[] = []
      for (let r = 0; r < rows.length; r++) {
        const cell = rows[r]?.[c]
        if (cell) newRow.push(cell)
        else newRow.push({ v: null })
      }
      transposed.push(newRow)
    }
    transposed.forEach((row, r) => {
      row.forEach((cell, c) => applyCell(inst, dest.sr + r, dest.sc + c, cell, 'all'))
    })
  } else {
    payload.rows.forEach((row, r) => {
      row.forEach((cell, c) => applyCell(inst, dest.sr + r, dest.sc + c, cell, mode))
    })
  }

  // ── Honour pending cut-clear ──
  if (pendingCutClear) {
    const { sheetId, sr, sc, er, ec } = pendingCutClear
    const activeSheetId = useWorkbookStore.getState().activeSheetId
    if (sheetId === activeSheetId) {
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          inst.setCellValue?.(r, c, null)
        }
      }
    }
    pendingCutClear = null
  }

  toast.success(`Pasted (${mode})`)
}
