/**
 * CSV-URL Connector
 *
 * Fetches a remote CSV file and parses it using the same robust parser as
 * the clipboard smart-paste feature (splitCsvLine logic from clipboardParser).
 * Supports quoted fields, escaped double-quotes, and CRLF line endings.
 *
 * Config fields:
 *   url       — Publicly accessible CSV URL (required)
 *   hasHeader — Whether the first row is a header (default true)
 *   delimiter — Field separator, default ","
 *
 * Security: no secret fields; config is safe to store in localStorage.
 */

import type { Connector, FetchResult, CellValue } from '../types'
import { inferColumnTypes } from '../utils/typeInferrer'

export interface CsvUrlConfig {
  url: string
  hasHeader?: boolean
  delimiter?: string
}

const SAMPLE_ROWS = 20

/** Split a single CSV line respecting quoted fields and escaped double-quotes. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? ''
    const next = line[i + 1] ?? ''

    // Escaped double-quote inside a quoted field
    if (ch === '"' && next === '"' && inQuotes) {
      current += '"'
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (ch === delimiter && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  values.push(current.trim())
  return values
}

/** Normalise a raw string cell value to a typed CellValue. */
function coerce(raw: string): CellValue {
  if (raw === '' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'na') return null
  const num = Number(raw.replace(/[$£€,%]/g, ''))
  if (!Number.isNaN(num) && raw.trim().length > 0) return num
  const lower = raw.toLowerCase()
  if (lower === 'true' || lower === 'yes') return true
  if (lower === 'false' || lower === 'no') return false
  return raw
}

async function parseCsvUrl(
  config: CsvUrlConfig,
  maxRows?: number
): Promise<FetchResult> {
  const { url, hasHeader = true, delimiter = ',' } = config

  const response = await fetch(url, { headers: { Accept: 'text/csv, text/plain, */*' } })
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV (HTTP ${response.status}): ${url}`)
  }

  const text = await response.text()
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (rawLines.length === 0) {
    return { columns: [], rows: [], columnTypes: [], rowCount: 0 }
  }

  let columns: string[]
  let dataLines: string[]

  if (hasHeader) {
    const headerLine = rawLines[0] ?? ''
    columns = splitCsvLine(headerLine, delimiter)
    dataLines = rawLines.slice(1)
  } else {
    // Auto-generate column names: Col1, Col2, …
    const firstLine = rawLines[0] ?? ''
    const colCount = splitCsvLine(firstLine, delimiter).length
    columns = Array.from({ length: colCount }, (_, i) => `Col${i + 1}`)
    dataLines = rawLines
  }

  const limit = maxRows !== undefined ? Math.min(dataLines.length, maxRows) : dataLines.length
  const rows: CellValue[][] = []

  for (let i = 0; i < limit; i += 1) {
    const line = dataLines[i]
    if (!line) continue
    const raw = splitCsvLine(line, delimiter)
    // Pad or trim to match column count
    const row: CellValue[] = columns.map((_, colIdx) => coerce(raw[colIdx] ?? ''))
    rows.push(row)
  }

  const columnTypes = inferColumnTypes(columns, rows)

  return { columns, rows, columnTypes, rowCount: rows.length }
}

export const csvUrlConnector: Connector<CsvUrlConfig> = {
  id: 'csv-url',
  name: 'CSV from URL',
  description: 'Import any publicly accessible CSV file by URL.',
  configSchema: [
    {
      name: 'url',
      label: 'CSV URL',
      kind: 'string',
      required: true,
      placeholder: 'https://example.com/data.csv',
    },
    {
      name: 'hasHeader',
      label: 'First row is header',
      kind: 'boolean',
      required: false,
      defaultValue: true,
    },
    {
      name: 'delimiter',
      label: 'Delimiter',
      kind: 'string',
      required: false,
      placeholder: ',',
      defaultValue: ',',
    },
  ],

  sample(config) {
    return parseCsvUrl(config, SAMPLE_ROWS)
  },

  fetch(config) {
    return parseCsvUrl(config)
  },
}
