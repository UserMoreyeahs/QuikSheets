'use client'

/**
 * PDF export — the heaviest of the export formats. Pulls in jsPDF +
 * jspdf-autotable and the page-layout print-settings store.
 *
 * Extracted from src/features/grid/utils/exportUtils.ts (Wave 4 split).
 * Public API is re-exported from exportUtils.ts for back-compat —
 * the one consumer (src/app/sheet/[id]/page.tsx, lazy-loaded) stays
 * byte-identical.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExportSheet } from '../exportUtils'
import { sanitizeCellForExport } from '../sanitizeForExport'

const EMPTY_HF = {
  headerLeft: '',
  headerCenter: '',
  headerRight: '',
  footerLeft: '',
  footerCenter: '',
  footerRight: '',
}

/** Read current print settings (orientation/margins/printArea/paperSize/headerFooter/printTitles). */
function readPrintSettings(): {
  orientation: 'portrait' | 'landscape'
  format: string
  marginsMm: { top: number; right: number; bottom: number; left: number }
  printRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null
  headerFooter: typeof EMPTY_HF
  /** 0-indexed [startRow, endRow] inclusive, or null. Rows repeated on every page. */
  printTitleRows: [number, number] | null
} {
  // Lazy require to avoid making this module depend on the page-layout
  // module tree at load time.
  type PrintStore = {
    getState(): {
      orientation: 'portrait' | 'landscape'
      paperSize: string
      margins: { top: number; right: number; bottom: number; left: number }
      printArea: { range: string } | null
      headerFooter?: typeof EMPTY_HF
      printTitles?: { rowsRange: string | null }
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
      printTitleRows: null,
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

  // Parse Print Titles "1:3" → [0, 2] (0-indexed inclusive).
  let printTitleRows: [number, number] | null = null
  if (s.printTitles?.rowsRange) {
    const m = s.printTitles.rowsRange.match(/^(\d+):(\d+)$/)
    if (m) {
      const start = parseInt(m[1]!, 10) - 1
      const end = parseInt(m[2]!, 10) - 1
      if (start >= 0 && end >= start) printTitleRows = [start, end]
    }
  }

  return {
    orientation: s.orientation,
    format: s.paperSize,
    marginsMm,
    printRange,
    headerFooter: s.headerFooter ?? EMPTY_HF,
    printTitleRows,
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

  // Resolve Print Titles into autoTable head rows so they repeat on
  // every page. If the user set rows 1:3, those rows become the head;
  // the body picks up from row 4 onwards. If no Print Titles, the
  // first row of working data acts as the head (Excel-default).
  // Stringify a cell for the PDF table AND neutralize formula-injection
  // payloads: a PDF cell can be copy-pasted straight into Excel/Sheets, so a
  // leading =/+/-/@/tab/CR still warrants the apostrophe guard. null → ''.
  const cellToStr = (cell: ExportSheet['data'][number][number]) =>
    cell !== null ? sanitizeCellForExport(String(cell)) : ''
  let headRows: string[][]
  let bodyStartIndex: number
  if (settings.printTitleRows) {
    const [tStart, tEnd] = settings.printTitleRows
    headRows = workingData.slice(tStart, tEnd + 1).map((row) => row.map(cellToStr))
    bodyStartIndex = tEnd + 1
    // Edge case: user picks rows beyond the data length — fall back to
    // the existing first-row-as-head behaviour so the PDF still renders.
    if (headRows.length === 0) {
      headRows = [(workingData[0] ?? []).map(cellToStr)]
      bodyStartIndex = 1
    }
  } else {
    headRows = [(workingData[0] ?? []).map(cellToStr)]
    bodyStartIndex = 1
  }
  const body = workingData
    .slice(bodyStartIndex)
    .map((row) => row.map(cellToStr))

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
    head: headRows,
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
