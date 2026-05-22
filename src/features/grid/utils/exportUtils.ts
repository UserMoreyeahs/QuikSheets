import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Sheet } from '@fortune-sheet/core'

// xlsx-js-style is a 320 KB fork of xlsx with style-write support. Code-split:
// only loads on the first call to exportToExcelFidelity, not on initial page load.
type XLSXStyleModule = {
  write: (wb: unknown, opts: { bookType: 'xlsx'; type: 'array' }) => ArrayBuffer
}
let xlsxStylePromise: Promise<XLSXStyleModule> | null = null
function getXLSXStyle(): Promise<XLSXStyleModule> {
  if (!xlsxStylePromise) {
    xlsxStylePromise = import('xlsx-js-style').then((mod) => {
      // CJS interop: depending on module resolution, the namespace either has
      // .write directly or behind .default. Pick whichever exposes write().
      const candidate = (mod as unknown as { default?: XLSXStyleModule }).default
      if (candidate && typeof candidate.write === 'function') return candidate
      return mod as unknown as XLSXStyleModule
    })
  }
  return xlsxStylePromise
}

export interface ExportSheet {
  name: string
  data: (string | number | boolean | null)[][]
}

/** Convert FortuneSheet column-letter index to SheetJS A1 notation. */
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

/**
 * Strip the leading '#' from a hex color (xlsx-js-style wants 'RRGGBB' or 'AARRGGBB').
 * Returns undefined for falsy / invalid input so we can spread conditionally.
 */
function hexNoHash(hex: unknown): string | undefined {
  if (typeof hex !== 'string') return undefined
  const trimmed = hex.replace(/^#/, '').toUpperCase()
  return /^[0-9A-F]{6,8}$/.test(trimmed) ? trimmed : undefined
}

/** FortuneSheet border style numeric → xlsx-js-style border style name. */
const BORDER_STYLE_MAP: Record<string, string> = {
  '1': 'thin',
  '2': 'hair',
  '3': 'dotted',
  '4': 'thick',
  '5': 'double',
  '6': 'dashed',
  '7': 'medium',
  '8': 'mediumDashed',
}

interface BorderInfoEntry {
  rangeType: string
  borderType: string // 'border-all' | 'border-outside' | 'border-top' | 'border-bottom' | 'border-left' | 'border-right' | 'border-none'
  style: string
  color: string
  range: { row: number[]; column: number[] }[]
}

interface BorderEdge {
  style: string
  color: { rgb: string }
}

/**
 * Walk the sheet's borderInfo entries and return per-edge border styles for
 * the cell at (r, c). Edges are top/right/bottom/left. Each edge is either
 * undefined (no border) or { style, color }.
 */
function getCellBorders(
  r: number,
  c: number,
  borderInfo: BorderInfoEntry[],
): { top?: BorderEdge; right?: BorderEdge; bottom?: BorderEdge; left?: BorderEdge } {
  const result: { top?: BorderEdge; right?: BorderEdge; bottom?: BorderEdge; left?: BorderEdge } = {}

  for (const entry of borderInfo) {
    const range = entry.range?.[0]
    if (!range || !range.row || !range.column) continue
    const [sr, er] = range.row
    const [sc, ec] = range.column
    if (sr === undefined || er === undefined || sc === undefined || ec === undefined) continue
    if (r < sr || r > er || c < sc || c > ec) continue

    const isFirstRow = r === sr
    const isLastRow = r === er
    const isFirstCol = c === sc
    const isLastCol = c === ec

    const styleName = BORDER_STYLE_MAP[entry.style] ?? 'thin'
    const colorHex = hexNoHash(entry.color) ?? '000000'
    const edge: BorderEdge = { style: styleName, color: { rgb: colorHex } }

    switch (entry.borderType) {
      case 'border-all':
        result.top = edge
        result.right = edge
        result.bottom = edge
        result.left = edge
        break
      case 'border-outside':
        if (isFirstRow) result.top = edge
        if (isLastRow) result.bottom = edge
        if (isFirstCol) result.left = edge
        if (isLastCol) result.right = edge
        break
      case 'border-top':
        if (isFirstRow) result.top = edge
        break
      case 'border-bottom':
        if (isLastRow) result.bottom = edge
        break
      case 'border-left':
        if (isFirstCol) result.left = edge
        break
      case 'border-right':
        if (isLastCol) result.right = edge
        break
      case 'border-none':
        delete result.top
        delete result.right
        delete result.bottom
        delete result.left
        break
    }
  }

  return result
}

/**
 * Build an xlsx-js-style cell.s object from a FortuneSheet cell's formatting
 * attributes. Returns undefined when the cell has no style at all.
 *
 * @param cell - the FortuneSheet cell with bg/fc/bl/it/etc. attributes
 * @param borders - per-edge border styles resolved from the sheet's borderInfo
 */
function buildCellStyle(
  cell: Record<string, unknown>,
  borders?: { top?: BorderEdge; right?: BorderEdge; bottom?: BorderEdge; left?: BorderEdge },
): Record<string, unknown> | undefined {
  const s: Record<string, unknown> = {}

  // Fill (background color)
  const bg = hexNoHash(cell.bg)
  if (bg) {
    s.fill = { patternType: 'solid', fgColor: { rgb: bg } }
  }

  // Font
  const font: Record<string, unknown> = {}
  const fc = hexNoHash(cell.fc)
  if (fc) font.color = { rgb: fc }
  if (cell.bl === 1 || cell.bl === '1') font.bold = true
  if (cell.it === 1 || cell.it === '1') font.italic = true
  if (cell.un === 1 || cell.un === '1') font.underline = true
  if (cell.cl === 1 || cell.cl === '1') font.strike = true
  if (typeof cell.fs === 'number' && cell.fs > 0) font.sz = cell.fs
  if (typeof cell.ff === 'string' && cell.ff) font.name = cell.ff
  if (Object.keys(font).length > 0) s.font = font

  // Alignment
  const alignment: Record<string, unknown> = {}
  if (cell.ht === 0 || cell.ht === '0') alignment.horizontal = 'center'
  else if (cell.ht === 1 || cell.ht === '1') alignment.horizontal = 'left'
  else if (cell.ht === 2 || cell.ht === '2') alignment.horizontal = 'right'
  if (cell.vt === 0 || cell.vt === '0') alignment.vertical = 'center'
  else if (cell.vt === 1 || cell.vt === '1') alignment.vertical = 'top'
  else if (cell.vt === 2 || cell.vt === '2') alignment.vertical = 'bottom'
  if (cell.tb === '2' || cell.tb === 2) alignment.wrapText = true
  if (Object.keys(alignment).length > 0) s.alignment = alignment

  // Border (each side independently)
  if (borders) {
    const border: Record<string, BorderEdge> = {}
    if (borders.top) border.top = borders.top
    if (borders.right) border.right = borders.right
    if (borders.bottom) border.bottom = borders.bottom
    if (borders.left) border.left = borders.left
    if (Object.keys(border).length > 0) s.border = border
  }

  return Object.keys(s).length > 0 ? s : undefined
}

/** Named range definition exported to Excel's Workbook.Names array. */
export interface ExportNamedRange {
  /** Excel-valid name (no spaces, must start with letter/underscore). */
  name: string
  /** Range in `Sheet1!A1:C10` form (or plain `A1:C10` for workbook-scoped). */
  range: string
  /** When set, name is scoped to a specific sheet rather than the workbook. */
  scopeSheetName?: string
  comment?: string
}

/** A single data-validation rule exported into xlsx-js-style's !dataValidation array. */
export interface ExportDataValidation {
  /** Sheet (by name) this rule applies to. */
  sheetName: string
  /** A1-notation range string, e.g. "B2:B100". */
  range: string
  /** Validation kind. We map our types onto the Excel set. */
  type: 'list' | 'whole' | 'decimal' | 'date' | 'time' | 'textLength'
  /** Comparison operator. Excel default is 'between' for numeric/date types. */
  operator?: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'lessThan' | 'lessThanOrEqual' | 'greaterThan' | 'greaterThanOrEqual'
  /** Primary formula1 — either a literal value or, for `list`, a comma-separated string of options. */
  formula1: string
  /** Secondary bound for `between`/`notBetween`. */
  formula2?: string
  /** User-facing error message when validation fails. */
  errorMessage?: string
}

/** Standard CF rule exported into the worksheet's conditionalFormatting block. */
export interface ExportCFRule {
  sheetName: string
  range: string
  /** Limited to the operator subset Excel natively understands. */
  type:
    | 'cellIs'
    | 'containsText'
    | 'notContainsText'
    | 'beginsWith'
    | 'endsWith'
    | 'duplicateValues'
    | 'uniqueValues'
    | 'aboveAverage'
    | 'belowAverage'
    | 'top10'
  operator?: 'between' | 'equal' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  formula1?: string
  formula2?: string
  /** Hex background fill (without #), e.g. "FFEB9C". */
  fill?: string
  /** Hex text color (without #), e.g. "9C5700". */
  color?: string
  bold?: boolean
  italic?: boolean
}

/** Optional extras for round-trip fidelity. */
export interface ExportExtras {
  namedRanges?: ExportNamedRange[]
  dataValidations?: ExportDataValidation[]
  conditionalFormatting?: ExportCFRule[]
}

/**
 * High-fidelity export: writes a FortuneSheet workbook to .xlsx preserving
 * formulas, number formats, merges, column widths, row heights, AND cell-
 * level visual styles (background color, font, bold/italic/underline/
 * strikethrough, alignment, wrap text).
 *
 * When `extras` is provided, the export also round-trips:
 *   - Named Ranges  (Excel Workbook.Names)
 *   - Data Validation rules (worksheet !dataValidation array)
 *   - Standard Conditional Formatting rules (worksheet conditionalFormatting)
 *
 * Visual CF rules (data bars, color scales, icon sets) are not yet
 * serialized — they remain in cfStore and will re-apply on next load.
 *
 * Uses xlsx-js-style for the write path (see hexNoHash + buildCellStyle).
 */
export async function exportToExcelFidelity(
  sheets: Sheet[],
  fileName: string = 'Quiksheets Export',
  extras: ExportExtras = {},
): Promise<void> {
  const workbook = XLSX.utils.book_new()

  for (const fs of sheets) {
    const sheetName = fs.name ?? 'Sheet'
    const matrix = fs.data ?? []
    const ws: Record<string, unknown> = {}

    // Border entries from sheet config — used per-cell to resolve which edges have borders
    const borderInfo = ((fs.config?.borderInfo ?? []) as unknown as BorderInfoEntry[])

    // Cells that need styles ONLY for borders (no value/formula). We need to walk
    // every cell intersected by any borderInfo entry, even empty ones, so the
    // resulting xlsx has a styled empty cell at that address.
    const borderCellAddrs = new Set<string>()
    for (const entry of borderInfo) {
      const range = entry.range?.[0]
      if (!range) continue
      const [sr, er] = range.row
      const [sc, ec] = range.column
      if (sr === undefined || er === undefined || sc === undefined || ec === undefined) continue
      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          borderCellAddrs.add(`${r}:${c}`)
        }
      }
    }

    let maxR = 0
    let maxC = 0

    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] ?? {}) as
          | { v?: unknown; f?: string; m?: unknown; ct?: { fa?: string; t?: string } }
        const hasContent = cell.v != null || cell.f
        const hasBorder = borderCellAddrs.has(`${r}:${c}`)
        if (!hasContent && !hasBorder) continue

        maxR = Math.max(maxR, r)
        maxC = Math.max(maxC, c)

        const addr = `${colIndexToLetter(c)}${r + 1}`
        const xlsxCell: Record<string, unknown> = {}

        // Determine type
        if (cell.f) {
          xlsxCell.f = cell.f.startsWith('=') ? cell.f.slice(1) : cell.f
          if (cell.v != null) xlsxCell.v = cell.v
          xlsxCell.t = typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's'
        } else if (typeof cell.v === 'number') {
          xlsxCell.v = cell.v
          xlsxCell.t = 'n'
        } else if (typeof cell.v === 'boolean') {
          xlsxCell.v = cell.v
          xlsxCell.t = 'b'
        } else if (hasContent) {
          xlsxCell.v = String(cell.v)
          xlsxCell.t = 's'
        } else {
          // Border-only cell: emit empty string with type 's' so xlsx records the addr
          xlsxCell.v = ''
          xlsxCell.t = 's'
        }

        // Number format
        if (cell.ct?.fa && cell.ct.fa !== 'General') {
          xlsxCell.z = cell.ct.fa
        }

        // Cell style (bg/fc/bl/it/un/cl/fs/ff/ht/vt/tb + borders)
        const cellBorders = borderInfo.length > 0 ? getCellBorders(r, c, borderInfo) : undefined
        const style = buildCellStyle(cell as Record<string, unknown>, cellBorders)
        if (style) xlsxCell.s = style

        ws[addr] = xlsxCell
      }
    }

    // Worksheet ref
    ws['!ref'] = `A1:${colIndexToLetter(Math.max(maxC, 0))}${Math.max(maxR + 1, 1)}`

    // Merged cells
    const merges = (fs.config?.merge ?? {}) as Record<
      string,
      { r: number; c: number; rs: number; cs: number }
    >
    const wsMerges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    for (const m of Object.values(merges)) {
      wsMerges.push({
        s: { r: m.r, c: m.c },
        e: { r: m.r + (m.rs ?? 1) - 1, c: m.c + (m.cs ?? 1) - 1 },
      })
    }
    if (wsMerges.length > 0) ws['!merges'] = wsMerges

    // Column widths (FortuneSheet stores in `columnlen` as Record<colIdx, px>)
    const colWidthMap = (fs.config?.columnlen ?? {}) as Record<string | number, number>
    if (Object.keys(colWidthMap).length > 0) {
      const cols: Array<{ wpx?: number }> = []
      for (let c = 0; c <= maxC; c++) {
        const px = colWidthMap[c] ?? colWidthMap[String(c)]
        cols[c] = px ? { wpx: px } : {}
      }
      ws['!cols'] = cols
    }

    // Row heights (`rowlen` as Record<rowIdx, px>)
    const rowHeightMap = (fs.config?.rowlen ?? {}) as Record<string | number, number>
    if (Object.keys(rowHeightMap).length > 0) {
      const rows: Array<{ hpx?: number }> = []
      for (let r = 0; r <= maxR; r++) {
        const px = rowHeightMap[r] ?? rowHeightMap[String(r)]
        rows[r] = px ? { hpx: px } : {}
      }
      ws['!rows'] = rows
    }

    // Per-sheet extras: data validation + conditional formatting
    // attached to this worksheet only. We collect them after both
    // structures know the sheet's final name.
    const dvForSheet = (extras.dataValidations ?? []).filter((d) => d.sheetName === sheetName)
    if (dvForSheet.length > 0) {
      ;(ws as Record<string, unknown>)['!dataValidation'] = dvForSheet.map((dv) => ({
        sqref: dv.range,
        type: dv.type,
        operator: dv.operator ?? 'between',
        formula1: dv.formula1,
        ...(dv.formula2 ? { formula2: dv.formula2 } : {}),
        ...(dv.errorMessage ? { error: dv.errorMessage, errorStyle: 'stop' } : {}),
      }))
    }

    const cfForSheet = (extras.conditionalFormatting ?? []).filter((r) => r.sheetName === sheetName)
    if (cfForSheet.length > 0) {
      // Group rules by range — Excel's conditionalFormatting block has
      // one entry per range (`sqref`) with a list of `cfRule` children.
      const byRange = new Map<string, ExportCFRule[]>()
      for (const rule of cfForSheet) {
        const arr = byRange.get(rule.range) ?? []
        arr.push(rule)
        byRange.set(rule.range, arr)
      }
      ;(ws as Record<string, unknown>)['!condfmt'] = Array.from(byRange.entries()).map(
        ([range, rules]) => ({
          ref: range,
          rules: rules.map((r, i) => ({
            type: r.type,
            ...(r.operator ? { operator: r.operator } : {}),
            ...(r.formula1 !== undefined ? { formula1: r.formula1 } : {}),
            ...(r.formula2 !== undefined ? { formula2: r.formula2 } : {}),
            priority: i + 1,
            dxf: {
              ...(r.fill ? { fill: { bgColor: { rgb: r.fill } } } : {}),
              ...(r.color || r.bold || r.italic
                ? {
                    font: {
                      ...(r.color ? { color: { rgb: r.color } } : {}),
                      ...(r.bold ? { bold: true } : {}),
                      ...(r.italic ? { italic: true } : {}),
                    },
                  }
                : {}),
            },
          })),
        }),
      )
    }

    XLSX.utils.book_append_sheet(workbook, ws as XLSX.WorkSheet, sheetName)
  }

  // Workbook-level extras: Named Ranges. Excel stores these in
  // Workbook.Names (the same place Excel reads when you open the
  // Name Manager). When `scopeSheetName` is set the name is scoped
  // to that sheet; otherwise it's workbook-scoped.
  const namedRanges = extras.namedRanges ?? []
  if (namedRanges.length > 0) {
    // xlsx's Workbook type is the WBProps interface; we attach Names to
    // it but TypeScript doesn't know about that field. Cast through
    // `unknown` to bypass the structural check — this is the same
    // pattern xlsx-js-style's own examples use.
    const wbAny = workbook as unknown as { Workbook?: Record<string, unknown> }
    wbAny.Workbook ??= {}
    const sheetIdByName = new Map<string, number>()
    sheets.forEach((s, i) => sheetIdByName.set(s.name ?? `Sheet${i + 1}`, i))
    wbAny.Workbook.Names = namedRanges.map((nr) => ({
      Name: nr.name,
      Ref: nr.range,
      ...(nr.scopeSheetName !== undefined && sheetIdByName.has(nr.scopeSheetName)
        ? { Sheet: sheetIdByName.get(nr.scopeSheetName) }
        : {}),
      ...(nr.comment ? { Comment: nr.comment } : {}),
    }))
  }

  // Use xlsx-js-style for the write so cell.s styles persist into the .xlsx
  const writer = await getXLSXStyle()
  const buffer = writer.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `${fileName}.xlsx`)
}

/**
 * Legacy values-only export. Kept for callers that don't have access to the
 * raw FortuneSheet `Sheet[]` (e.g. CSV/PDF flows that only need cell text).
 */
export function exportToExcel(
  sheets: ExportSheet[],
  fileName: string = 'Quiksheets Export'
): void {
  const workbook = XLSX.utils.book_new()

  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  saveAs(blob, `${fileName}.xlsx`)
}

export function exportToCSV(
  sheet: ExportSheet,
  fileName: string = 'Quiksheets Export'
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(sheet.data)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${fileName}.csv`)
}

/**
 * Empty header/footer used when the print-settings store hasn't been
 * loaded (e.g. legacy unit tests that import exportUtils directly).
 */
const EMPTY_HF = {
  headerLeft: '',
  headerCenter: '',
  headerRight: '',
  footerLeft: '',
  footerCenter: '',
  footerRight: '',
}

/** Read current print settings (orientation/margins/printArea/paperSize/headerFooter). */
function readPrintSettings(): {
  orientation: 'portrait' | 'landscape'
  format: string
  marginsMm: { top: number; right: number; bottom: number; left: number }
  printRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null
  headerFooter: typeof EMPTY_HF
} {
  // Lazy import to avoid making exportUtils.ts depend on the page-layout module
  // tree at the top level (keeps the legacy exportToCSV / exportToExcel paths
  // free of the print-settings dep).
  type PrintStore = {
    getState(): {
      orientation: 'portrait' | 'landscape'
      paperSize: string
      margins: { top: number; right: number; bottom: number; left: number }
      printArea: { range: string } | null
      headerFooter?: typeof EMPTY_HF
    }
  }
  let store: PrintStore | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require('@/features/page-layout/printSettingsStore').usePrintSettingsStore as PrintStore
  } catch { /* fallback to defaults */ }

  if (!store) {
    return {
      orientation: 'landscape',
      format: 'a4',
      marginsMm: { top: 19, right: 18, bottom: 19, left: 18 },
      printRange: null,
      headerFooter: EMPTY_HF,
    }
  }

  const s = store.getState()
  // Convert inches to mm (1 inch = 25.4 mm)
  const marginsMm = {
    top:    s.margins.top * 25.4,
    right:  s.margins.right * 25.4,
    bottom: s.margins.bottom * 25.4,
    left:   s.margins.left * 25.4,
  }

  // Parse print area range "A1:F25" → indices
  let printRange = null as ReturnType<typeof readPrintSettings>['printRange']
  if (s.printArea?.range) {
    const m = s.printArea.range.toUpperCase().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
    if (m) {
      function colLetterToIndex(letter: string): number {
        let result = 0
        for (let i = 0; i < letter.length; i++) result = result * 26 + (letter.charCodeAt(i) - 64)
        return result - 1
      }
      printRange = {
        startCol: colLetterToIndex(m[1]!),
        startRow: parseInt(m[2]!, 10) - 1,
        endCol: colLetterToIndex(m[3]!),
        endRow: parseInt(m[4]!, 10) - 1,
      }
    }
  }

  return {
    orientation: s.orientation,
    format: s.paperSize,
    marginsMm,
    printRange,
    headerFooter: s.headerFooter ?? EMPTY_HF,
  }
}

export function exportToPDF(
  sheet: ExportSheet,
  fileName: string = 'Quiksheets Export'
): void {
  const settings = readPrintSettings()
  const doc = new jsPDF({ orientation: settings.orientation, unit: 'mm', format: settings.format })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Whether the user actually configured a header/footer. If not, we
  // fall back to the legacy title + "Exported from Quiksheets" line on
  // page 1 only — keeps existing exports looking the same.
  const hf = settings.headerFooter
  const hasCustomHF =
    !!(hf.headerLeft || hf.headerCenter || hf.headerRight ||
       hf.footerLeft || hf.footerCenter || hf.footerRight)

  // Lazy require so we don't pull the page-layout module into the
  // legacy CSV/XLSX export paths.
  function substitute(template: string, page: number, pages: number): string {
    if (!template) return ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/features/page-layout/utils/headerFooterTokens') as {
        substituteHeaderFooterTokens: (t: string, ctx: {
          page: number; pages: number; sheet: string; file: string
        }) => string
      }
      return mod.substituteHeaderFooterTokens(template, {
        page,
        pages,
        sheet: sheet.name,
        file: fileName,
      })
    } catch {
      // Fallback: simple inline substitution so the legacy unit test path
      // still produces sensible output without depending on page-layout.
      return template
        .replace(/&\[Page\]/g, String(page))
        .replace(/&\[Pages\]/g, String(pages))
    }
  }

  if (sheet.data.length === 0) {
    if (!hasCustomHF) {
      doc.setFontSize(14)
      doc.setTextColor(30, 30, 30)
      doc.text(sheet.name, 14, 15)
    }
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text('No data to export', 14, 35)
    doc.save(`${fileName}.pdf`)
    return
  }

  // If a print area is set, slice the data to that range. Otherwise use all rows.
  let workingData = sheet.data
  if (settings.printRange) {
    const { startRow, endRow, startCol, endCol } = settings.printRange
    workingData = sheet.data
      .slice(startRow, endRow + 1)
      .map((row) => row.slice(startCol, endCol + 1))
  }

  const firstRow = workingData[0] ?? []
  const headers = firstRow.map((header) => (header !== null ? String(header) : ''))
  const body = workingData
    .slice(1)
    .map((row) => row.map((cell) => (cell !== null ? String(cell) : '')))

  // Reserve vertical space at the top/bottom for the header/footer rows.
  // 8mm fits a single-line 9pt header with comfortable padding; the
  // autoTable `margin.top` / `margin.bottom` reservation keeps the table
  // body from overlapping the header/footer band.
  const HF_BAND_MM = 8
  const reserveTop = hasCustomHF
    ? settings.marginsMm.top + HF_BAND_MM
    : settings.marginsMm.top
  const reserveBottom = hasCustomHF
    ? settings.marginsMm.bottom + HF_BAND_MM
    : settings.marginsMm.bottom

  autoTable(doc, {
    head: [headers],
    body,
    startY: hasCustomHF ? reserveTop : 28,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: {
      top: reserveTop,
      right: settings.marginsMm.right,
      bottom: reserveBottom,
      left: settings.marginsMm.left,
    },
    didDrawPage: (data) => {
      const totalPages = doc.getNumberOfPages()
      const page = data.pageNumber
      if (hasCustomHF) {
        // Header band (left / center / right)
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        const headerY = settings.marginsMm.top + 4
        if (hf.headerLeft)   doc.text(substitute(hf.headerLeft,   page, totalPages), settings.marginsMm.left, headerY, { align: 'left'   })
        if (hf.headerCenter) doc.text(substitute(hf.headerCenter, page, totalPages), pageW / 2,                headerY, { align: 'center' })
        if (hf.headerRight)  doc.text(substitute(hf.headerRight,  page, totalPages), pageW - settings.marginsMm.right, headerY, { align: 'right'  })

        // Footer band (left / center / right)
        const footerY = pageH - settings.marginsMm.bottom + 4
        if (hf.footerLeft)   doc.text(substitute(hf.footerLeft,   page, totalPages), settings.marginsMm.left, footerY, { align: 'left'   })
        if (hf.footerCenter) doc.text(substitute(hf.footerCenter, page, totalPages), pageW / 2,                footerY, { align: 'center' })
        if (hf.footerRight)  doc.text(substitute(hf.footerRight,  page, totalPages), pageW - settings.marginsMm.right, footerY, { align: 'right'  })
      } else if (page === 1) {
        // Legacy fallback — sheet name + export date on page 1 only.
        doc.setFontSize(14)
        doc.setTextColor(30, 30, 30)
        doc.text(sheet.name, 14, 15)
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text(`Exported from Quiksheets - ${new Date().toLocaleDateString()}`, 14, 22)
      }
    },
  })

  doc.save(`${fileName}.pdf`)
}
