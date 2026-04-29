import * as XLSX from 'xlsx'

export interface ImportedSheet {
  name: string
  data: (string | number | boolean | null)[][]
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

          return { name, data: rows }
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
