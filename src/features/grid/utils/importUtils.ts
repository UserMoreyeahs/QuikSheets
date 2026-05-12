import * as XLSX from 'xlsx'

export interface ImportedSheet {
  name: string
  data: (string | number | boolean | null)[][]
  /** Optional high-fidelity per-cell metadata. Present when imported xlsx has formulas/formats/merges. */
  fidelity?: ImportFidelity
}

/** Per-cell metadata preserved from the source xlsx. */
export interface ImportFidelity {
  /** formulas keyed by 'r:c' — value is formula text without the leading '=' */
  formulas: Record<string, string>
  /** number formats keyed by 'r:c' — e.g. '0.00', '$#,##0.00', 'mm/dd/yyyy' */
  numberFormats: Record<string, string>
  /** merged ranges */
  merges: Array<{ r: number; c: number; rs: number; cs: number }>
  /** column widths in pixels keyed by col index */
  colWidths: Record<number, number>
  /** row heights in pixels keyed by row index */
  rowHeights: Record<number, number>
}

export interface ImportResult {
  sheets: ImportedSheet[]
  fileName: string
  error: string | null
}

/**
 * Imports an Excel or CSV file using SheetJS.
 * Returns structured sheet data for all sheets in the workbook.
 */
export async function importFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const rawData = e.target?.result
        if (!rawData) {
          resolve({ sheets: [], fileName: file.name, error: 'Failed to read file' })
          return
        }

        const workbook = XLSX.read(rawData, {
          type: 'binary',
          cellDates: true,
          cellNF: true,
        })

        const sheets: ImportedSheet[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name]
          if (!sheet) return { name, data: [] }

          const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
            header: 1,
            defval: null,
            blankrows: true,
          })

          // Build per-cell fidelity map by walking the worksheet directly.
          // SheetJS stores cells at A1-style address keys with shape:
          //   { v?: any, f?: string (no leading '='), z?: string, t: 'n'|'s'|'b'|'d'|'e' }
          const fidelity: ImportFidelity = {
            formulas: {},
            numberFormats: {},
            merges: [],
            colWidths: {},
            rowHeights: {},
          }
          for (const key of Object.keys(sheet)) {
            if (key.startsWith('!')) continue
            // Parse address e.g. "B5"
            const match = key.match(/^([A-Z]+)(\d+)$/)
            if (!match) continue
            const colLetters = match[1]!
            const rowStr = match[2]!
            let c = 0
            for (let i = 0; i < colLetters.length; i++) {
              c = c * 26 + (colLetters.charCodeAt(i) - 64)
            }
            c -= 1
            const r = parseInt(rowStr, 10) - 1
            const cell = sheet[key] as { v?: unknown; f?: string; z?: string; t?: string } | undefined
            if (!cell) continue
            const cellKey = `${r}:${c}`
            if (cell.f) fidelity.formulas[cellKey] = cell.f
            if (cell.z && cell.z !== 'General') fidelity.numberFormats[cellKey] = cell.z
          }

          // Merges
          const wsMerges = (sheet as unknown as { '!merges'?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> })['!merges']
          if (wsMerges) {
            for (const m of wsMerges) {
              fidelity.merges.push({
                r: m.s.r,
                c: m.s.c,
                rs: m.e.r - m.s.r + 1,
                cs: m.e.c - m.s.c + 1,
              })
            }
          }

          // Column widths
          const wsCols = (sheet as unknown as { '!cols'?: Array<{ wpx?: number; wch?: number }> })['!cols']
          if (wsCols) {
            wsCols.forEach((col, idx) => {
              if (!col) return
              const px = col.wpx ?? (col.wch ? Math.round(col.wch * 7) : undefined)
              if (px) fidelity.colWidths[idx] = px
            })
          }

          // Row heights
          const wsRows = (sheet as unknown as { '!rows'?: Array<{ hpx?: number; hpt?: number }> })['!rows']
          if (wsRows) {
            wsRows.forEach((row, idx) => {
              if (!row) return
              const px = row.hpx ?? (row.hpt ? Math.round((row.hpt * 96) / 72) : undefined)
              if (px) fidelity.rowHeights[idx] = px
            })
          }

          return { name, data: rows, fidelity }
        })

        resolve({ sheets, fileName: file.name, error: null })
      } catch {
        resolve({
          sheets: [],
          fileName: file.name,
          error: 'Failed to parse file. Make sure it is a valid Excel or CSV file.',
        })
      }
    }

    reader.onerror = () => {
      resolve({ sheets: [], fileName: file.name, error: 'Failed to read file from disk.' })
    }

    reader.readAsBinaryString(file)
  })
}

/** Accepted file extensions for the file input. */
export const ACCEPTED_FILE_TYPES = '.xlsx,.xls,.csv,.tsv,.ods'

/**
 * Returns the first maxRows rows of imported data for preview.
 */
export function getImportPreview(
  sheet: ImportedSheet,
  maxRows: number = 10
): (string | number | boolean | null)[][] {
  return sheet.data.slice(0, maxRows)
}
