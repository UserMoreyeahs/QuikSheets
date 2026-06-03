/**
 * Column type inference utilities shared across all connectors.
 *
 * Inspects a sample of values from a single column and returns a
 * `ColumnTypeHint` that the wizard uses to pre-populate the transform selector.
 */

import type { CellValue, ColumnTypeHint } from '../types'

// Loose ISO-8601 and common date patterns
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/,  // ISO-8601
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,         // MM/DD/YYYY
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,           // MM-DD-YYYY
  /^\d{1,2}\s+\w{3,9}\s+\d{4}$/,         // 1 Jan 2024
]

function looksLikeDate(value: string): boolean {
  return DATE_PATTERNS.some((re) => re.test(value.trim()))
}

function looksLikeNumber(value: string): boolean {
  const stripped = value.replace(/[$£€,%]/g, '').trim()
  return stripped.length > 0 && !Number.isNaN(Number(stripped))
}

function looksLikeBoolean(value: string): boolean {
  const lower = value.toLowerCase().trim()
  return lower === 'true' || lower === 'false' || lower === '1' || lower === '0' ||
    lower === 'yes' || lower === 'no'
}

/**
 * Infer the dominant type of a column from up to the first 20 non-null values.
 */
export function inferColumnType(values: CellValue[]): ColumnTypeHint {
  const sample = values
    .filter((v): v is NonNullable<CellValue> => v !== null && v !== undefined && v !== '')
    .slice(0, 20)

  if (sample.length === 0) return 'string'

  const counts: Record<ColumnTypeHint, number> = {
    number: 0,
    date: 0,
    boolean: 0,
    string: 0,
    mixed: 0,
  }

  for (const v of sample) {
    if (typeof v === 'number') {
      counts.number += 1
    } else if (typeof v === 'boolean') {
      counts.boolean += 1
    } else {
      const str = String(v)
      if (looksLikeDate(str)) {
        counts.date += 1
      } else if (looksLikeNumber(str)) {
        counts.number += 1
      } else if (looksLikeBoolean(str)) {
        counts.boolean += 1
      } else {
        counts.string += 1
      }
    }
  }

  const total = sample.length
  const threshold = 0.75 * total

  if (counts.number >= threshold) return 'number'
  if (counts.date >= threshold) return 'date'
  if (counts.boolean >= threshold) return 'boolean'
  if (counts.string >= threshold) return 'string'
  return 'mixed'
}

/**
 * Infer column types for every column in a result set.
 *
 * @param columns - Ordered column names.
 * @param rows - Data rows (may be empty for header-only results).
 */
export function inferColumnTypes(
  columns: string[],
  rows: CellValue[][]
): ColumnTypeHint[] {
  return columns.map((_, colIdx) => {
    const colValues = rows.map((row) => row[colIdx] ?? null)
    return inferColumnType(colValues)
  })
}
