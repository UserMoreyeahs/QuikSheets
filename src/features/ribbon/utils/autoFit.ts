'use client'

/**
 * AutoFit helpers — measure cell content and compute the best
 * row height / column width for the selection.
 *
 * Excel's AutoFit:
 *   - Column width: longest text in column, no wrap → set column width
 *     to fit it + a small padding. Capped at ~250 chars.
 *   - Row height: with wrap on, height grows to fit all wrapped lines;
 *     without wrap, height is just the font size.
 *
 * We use a hidden HTML <canvas> 2D context for measurement (faster and
 * more accurate than offscreen DOM). The canvas is reused across calls.
 */

import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { getSheetMatrix } from '@/lib/fortuneSheet'

/** Default Excel font for measurement when a cell has no explicit font. */
const DEFAULT_FONT_PX = 11
const DEFAULT_FONT_FAMILY = 'Calibri, Arial, sans-serif'

/** Padding added to the measured text width (left + right) in pixels. */
const COLUMN_PADDING_PX = 14
/** Padding added to the measured text height (top + bottom) in pixels. */
const ROW_PADDING_PX = 6

/** Maximum widths we'll auto-set to — match Excel's behavior. */
const MAX_COL_WIDTH = 400
const MIN_COL_WIDTH = 30
const MAX_ROW_HEIGHT = 409
const MIN_ROW_HEIGHT = 16

// Reused canvas so we don't allocate one per call.
let _measureCanvas: HTMLCanvasElement | null = null
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas')
  }
  return _measureCanvas.getContext('2d')
}

interface CellMeta {
  text: string
  fontPx: number
  bold: boolean
  italic: boolean
  fontFamily: string
}

/** Read a FortuneSheet cell and extract the displayable text + font hints. */
function readCellMeta(cell: unknown): CellMeta {
  const c = (cell ?? {}) as {
    v?: unknown
    m?: string
    fs?: number
    bl?: 0 | 1
    it?: 0 | 1
    ff?: string
  }
  const text = c.m ?? (c.v == null ? '' : String(c.v))
  return {
    text,
    fontPx: typeof c.fs === 'number' && c.fs > 0 ? c.fs : DEFAULT_FONT_PX,
    bold: c.bl === 1,
    italic: c.it === 1,
    fontFamily: typeof c.ff === 'string' && c.ff ? c.ff : DEFAULT_FONT_FAMILY,
  }
}

/** Measure how wide a string would render in pixels using the cell's font. */
function measureWidth(ctx: CanvasRenderingContext2D, meta: CellMeta): number {
  const weight = meta.bold ? '700' : '400'
  const style = meta.italic ? 'italic' : 'normal'
  ctx.font = `${style} ${weight} ${meta.fontPx}px ${meta.fontFamily}`
  // Measure the longest individual line (for multi-line wrapped text).
  let longest = 0
  for (const line of meta.text.split('\n')) {
    const w = ctx.measureText(line).width
    if (w > longest) longest = w
  }
  return longest
}

/**
 * Auto-fit the width of each column in the selected range to the
 * longest content in that column. Returns the new width map keyed
 * by column index, ready to pass to gridInstance.setColumnWidth.
 */
export function autoFitColumns(): void {
  const inst = useSheetStore.getState().gridInstance
  const { selectedRange, selectedCell, gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const ctx = getMeasureCtx()
  if (!inst || !ctx) return

  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) return
  const matrix = getSheetMatrix(sheet)
  if (matrix.length === 0) return

  const startCol = selectedRange
    ? Math.min(selectedRange.start.col, selectedRange.end.col)
    : selectedCell?.col ?? 0
  const endCol = selectedRange
    ? Math.max(selectedRange.start.col, selectedRange.end.col)
    : selectedCell?.col ?? 0

  const widths: Record<number, number> = {}
  for (let c = startCol; c <= endCol; c++) {
    let bestPx = MIN_COL_WIDTH
    // Sample up to first 200 rows to keep performance bounded on huge sheets.
    const sampleEnd = Math.min(matrix.length, 200)
    for (let r = 0; r < sampleEnd; r++) {
      const meta = readCellMeta(matrix[r]?.[c])
      if (!meta.text) continue
      const w = measureWidth(ctx, meta) + COLUMN_PADDING_PX
      if (w > bestPx) bestPx = w
    }
    widths[c] = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.round(bestPx)))
  }
  try {
    ;(inst as unknown as { setColumnWidth: (cfg: Record<number, number>) => void }).setColumnWidth(widths)
  } catch {
    /* swallow — toast handled upstream */
  }
}

/**
 * Auto-fit the height of each row in the selected range.
 *
 * For wrapped cells we compute the wrapped-line count using the
 * column's current width as the constraint. For non-wrap cells we
 * just take the font size + padding.
 */
export function autoFitRows(): void {
  const inst = useSheetStore.getState().gridInstance
  const { selectedRange, selectedCell, gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const ctx = getMeasureCtx()
  if (!inst || !ctx) return

  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) return
  const matrix = getSheetMatrix(sheet)

  const startRow = selectedRange
    ? Math.min(selectedRange.start.row, selectedRange.end.row)
    : selectedCell?.row ?? 0
  const endRow = selectedRange
    ? Math.max(selectedRange.start.row, selectedRange.end.row)
    : selectedCell?.row ?? 0

  // Look up current column widths from the sheet config so wrap math is accurate.
  const colWidths = (sheet.config?.columnlen ?? {}) as Record<string, number>

  const heights: Record<number, number> = {}
  for (let r = startRow; r <= endRow; r++) {
    let bestPx = MIN_ROW_HEIGHT
    const row = matrix[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const meta = readCellMeta(row[c])
      if (!meta.text) continue
      const isWrap = ((row[c] ?? {}) as { tb?: '0' | '2' }).tb === '2'
      const lineHeight = meta.fontPx * 1.4
      let lines = 1
      if (isWrap) {
        const colW = colWidths[String(c)] ?? colWidths[c] ?? 74
        const usable = Math.max(20, colW - COLUMN_PADDING_PX)
        const w = measureWidth(ctx, meta)
        lines = Math.max(1, Math.ceil(w / usable))
        lines = Math.max(lines, meta.text.split('\n').length)
      } else {
        lines = meta.text.split('\n').length
      }
      const px = lineHeight * lines + ROW_PADDING_PX
      if (px > bestPx) bestPx = px
    }
    heights[r] = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, Math.round(bestPx)))
  }
  try {
    ;(inst as unknown as { setRowHeight: (cfg: Record<number, number>) => void }).setRowHeight(heights)
  } catch {
    /* swallow */
  }
}
