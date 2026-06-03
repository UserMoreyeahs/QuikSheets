/**
 * fromWebParser — sniff + parse data fetched by /api/data/fetch.
 *
 * Detects the response shape (CSV vs JSON), parses it, and returns a
 * 2-D array of cell values where row 0 is the header. We do this
 * client-side after the server proxy returns the raw text so the
 * server endpoint stays generic.
 *
 * CSV: handles quoted fields with embedded commas / quotes / newlines.
 *
 * JSON: supports two shapes —
 *   1. Array of plain objects   → headers from union of keys
 *   2. Array of arrays          → first row treated as header
 */

export type CellValue = string | number | boolean | null

export interface ParsedTable {
  rows: CellValue[][]
  /** "csv" / "json-objects" / "json-arrays" — tells the user what we sniffed. */
  format: 'csv' | 'json-objects' | 'json-arrays'
  rowCount: number
  colCount: number
}

/** Detect the dominant format from text + content-type hint. */
function sniffFormat(text: string, contentType: string): 'csv' | 'json' {
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json'
  if (/json/i.test(contentType)) return 'json'
  return 'csv'
}

/**
 * Minimal CSV parser — handles quoted fields with embedded commas /
 * quotes / newlines. Pure JS, no deps. Good enough for the common
 * "download.csv" URLs users paste here.
 */
function parseCsv(text: string): CellValue[][] {
  const rows: CellValue[][] = []
  let row: CellValue[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const c = text[i]!

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote inside quoted field
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(coerce(field)); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') {
      row.push(coerce(field))
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }

    field += c
    i++
  }

  // Trailing cell + row (file may not end in newline)
  if (field !== '' || row.length > 0) {
    row.push(coerce(field))
    rows.push(row)
  }

  // Normalize ragged rows — pad short rows with null so the 2-D array
  // is rectangular.
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  for (const r of rows) {
    while (r.length < maxCols) r.push(null)
  }
  return rows
}

function coerce(raw: string): CellValue {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  // Booleans
  if (trimmed === 'true' || trimmed === 'TRUE') return true
  if (trimmed === 'false' || trimmed === 'FALSE') return false
  // Numbers — strict: must match a full numeric literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return trimmed
}

/** JSON array-of-objects → headers union + body rows. */
function parseJsonObjects(arr: Record<string, unknown>[]): CellValue[][] {
  // Collect header order: insertion order of first occurrence across rows.
  const headers: string[] = []
  const seen = new Set<string>()
  for (const obj of arr) {
    for (const key of Object.keys(obj)) {
      if (!seen.has(key)) { seen.add(key); headers.push(key) }
    }
  }
  const rows: CellValue[][] = [headers.slice()]
  for (const obj of arr) {
    rows.push(headers.map((h) => normalizeJsonCell(obj[h])))
  }
  return rows
}

function parseJsonArrays(arr: unknown[][]): CellValue[][] {
  return arr.map((row) => row.map(normalizeJsonCell))
}

function normalizeJsonCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  // Objects / arrays → JSON string so the user sees something meaningful
  // rather than "[object Object]".
  try { return JSON.stringify(v) } catch { return String(v) }
}

export function parseFetchedTable(text: string, contentType: string): ParsedTable {
  const fmt = sniffFormat(text, contentType)

  if (fmt === 'csv') {
    const rows = parseCsv(text)
    return {
      rows,
      format: 'csv',
      rowCount: rows.length,
      colCount: rows[0]?.length ?? 0,
    }
  }

  // JSON
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (err) {
    throw new Error(`Not valid JSON: ${err instanceof Error ? err.message : 'unknown'}`)
  }
  if (!Array.isArray(json)) {
    // Single object → wrap as one-row table
    if (typeof json === 'object' && json !== null) {
      const rows = parseJsonObjects([json as Record<string, unknown>])
      return { rows, format: 'json-objects', rowCount: rows.length, colCount: rows[0]?.length ?? 0 }
    }
    throw new Error('JSON root must be an array or an object.')
  }

  if (json.length === 0) {
    return { rows: [], format: 'json-objects', rowCount: 0, colCount: 0 }
  }

  // Determine flavour by inspecting the first element.
  const first = json[0]
  if (Array.isArray(first)) {
    const rows = parseJsonArrays(json as unknown[][])
    return { rows, format: 'json-arrays', rowCount: rows.length, colCount: rows[0]?.length ?? 0 }
  }
  if (typeof first === 'object' && first !== null) {
    const rows = parseJsonObjects(json as Record<string, unknown>[])
    return { rows, format: 'json-objects', rowCount: rows.length, colCount: rows[0]?.length ?? 0 }
  }
  throw new Error('JSON array elements must be objects or arrays.')
}
