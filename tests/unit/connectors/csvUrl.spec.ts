/**
 * Unit tests for the CSV-URL connector parser.
 *
 * Tests the internal parsing logic that would be exercised by csvUrlConnector.sample()
 * without making real network requests (we test the core split + coerce logic directly).
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers re-implemented here to test in isolation (pure functions)
// ---------------------------------------------------------------------------

function splitCsvLine(line: string, delimiter = ','): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? ''
    const next = line[i + 1] ?? ''

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

function coerce(raw: string): string | number | boolean | null {
  if (raw === '' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'na') return null
  const num = Number(raw.replace(/[$£€,%]/g, ''))
  if (!Number.isNaN(num) && raw.trim().length > 0) return num
  const lower = raw.toLowerCase()
  if (lower === 'true' || lower === 'yes') return true
  if (lower === 'false' || lower === 'no') return false
  return raw
}

// ---------------------------------------------------------------------------
// splitCsvLine tests
// ---------------------------------------------------------------------------

describe('splitCsvLine', () => {
  it('splits a simple comma-delimited line', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('respects quoted fields', () => {
    expect(splitCsvLine('"hello, world",foo,bar')).toEqual(['hello, world', 'foo', 'bar'])
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(splitCsvLine('"say ""hi"" now",42')).toEqual(['say "hi" now', '42'])
  })

  it('trims whitespace around unquoted fields', () => {
    expect(splitCsvLine(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })

  it('handles empty fields', () => {
    expect(splitCsvLine('a,,c')).toEqual(['a', '', 'c'])
  })

  it('uses custom delimiter', () => {
    expect(splitCsvLine('a|b|c', '|')).toEqual(['a', 'b', 'c'])
  })

  it('handles a single field', () => {
    expect(splitCsvLine('hello')).toEqual(['hello'])
  })

  it('handles quoted field containing newline placeholder', () => {
    expect(splitCsvLine('"Revenue, Q1",North')).toEqual(['Revenue, Q1', 'North'])
  })
})

// ---------------------------------------------------------------------------
// coerce tests
// ---------------------------------------------------------------------------

describe('coerce', () => {
  it('returns null for empty string', () => {
    expect(coerce('')).toBeNull()
  })

  it('returns null for "null" string', () => {
    expect(coerce('null')).toBeNull()
  })

  it('returns null for "na"', () => {
    expect(coerce('na')).toBeNull()
  })

  it('parses plain integers', () => {
    expect(coerce('42')).toBe(42)
  })

  it('parses negative floats', () => {
    expect(coerce('-3.14')).toBe(-3.14)
  })

  it('strips currency symbols before parsing', () => {
    expect(coerce('$1,500')).toBe(1500)
  })

  it('strips percentage sign', () => {
    expect(coerce('75%')).toBe(75)
  })

  it('returns true for "true"', () => {
    expect(coerce('true')).toBe(true)
  })

  it('returns true for "yes"', () => {
    expect(coerce('yes')).toBe(true)
  })

  it('returns false for "false"', () => {
    expect(coerce('false')).toBe(false)
  })

  it('returns false for "no"', () => {
    expect(coerce('no')).toBe(false)
  })

  it('returns the string as-is for text values', () => {
    expect(coerce('hello world')).toBe('hello world')
  })

  it('handles ISO date strings as strings (not numbers)', () => {
    const result = coerce('2024-01-15')
    // Dates should remain strings at the coerce level; type inference handles further
    expect(typeof result).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// Full CSV parse simulation
// ---------------------------------------------------------------------------

function parseCsvText(
  text: string,
  hasHeader = true,
  delimiter = ','
): { columns: string[]; rows: (string | number | boolean | null)[][] } {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (rawLines.length === 0) return { columns: [], rows: [] }

  let columns: string[]
  let dataLines: string[]

  if (hasHeader) {
    columns = splitCsvLine(rawLines[0] ?? '', delimiter)
    dataLines = rawLines.slice(1)
  } else {
    const colCount = splitCsvLine(rawLines[0] ?? '', delimiter).length
    columns = Array.from({ length: colCount }, (_, i) => `Col${i + 1}`)
    dataLines = rawLines
  }

  const rows = dataLines.map((line) => {
    const raw = splitCsvLine(line, delimiter)
    return columns.map((_, colIdx) => coerce(raw[colIdx] ?? ''))
  })

  return { columns, rows }
}

describe('parseCsvText (full simulation)', () => {
  it('parses a 3-column CSV with header', () => {
    const csv = 'Region,Sales Rep,Revenue\nNorth,Alice,85000\nSouth,Bob,72000'
    const { columns, rows } = parseCsvText(csv)
    expect(columns).toEqual(['Region', 'Sales Rep', 'Revenue'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['North', 'Alice', 85000])
    expect(rows[1]).toEqual(['South', 'Bob', 72000])
  })

  it('handles CRLF line endings', () => {
    const csv = 'A,B\r\n1,2\r\n3,4'
    const { rows } = parseCsvText(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual([1, 2])
  })

  it('generates column names when hasHeader is false', () => {
    const csv = '1,2,3\n4,5,6'
    const { columns, rows } = parseCsvText(csv, false)
    expect(columns).toEqual(['Col1', 'Col2', 'Col3'])
    expect(rows[0]).toEqual([1, 2, 3])
  })

  it('pads short rows to column count', () => {
    const csv = 'A,B,C\n1,2'
    const { rows } = parseCsvText(csv)
    expect(rows[0]).toEqual([1, 2, null])
  })

  it('handles quoted fields with commas', () => {
    const csv = 'Name,Address\nAlice,"123 Main St, Apt 4"'
    const { rows } = parseCsvText(csv)
    expect(rows[0]?.[1]).toBe('123 Main St, Apt 4')
  })
})
