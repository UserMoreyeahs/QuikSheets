/**
 * Sanitize a cell value before importing it from a CSV/XLSX source.
 *
 * Excel/Sheets/Numbers will execute formulas if the cell value begins with
 * =, +, -, @, |, %, or 0x followed by a hex byte. Prefixing such values with
 * an apostrophe forces them to be treated as text. Returns the original
 * value untouched when no risk is detected.
 *
 * Reference: OWASP CSV Injection (Formula Injection).
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '|', '%']

export function sanitizeImportedCellValue(value: unknown): string | unknown {
  if (typeof value !== 'string' || value.length === 0) return value
  const first = value[0]!
  if (FORMULA_TRIGGERS.includes(first)) return `'${value}`
  // 0x... that could become e.g. =0x... in Excel; safer to neutralize
  if (/^0x/i.test(value)) return `'${value}`
  return value
}

export function sanitizeRow(row: unknown[]): unknown[] {
  return row.map((v) => sanitizeImportedCellValue(v))
}

export function sanitizeMatrix(matrix: unknown[][]): unknown[][] {
  return matrix.map(sanitizeRow)
}
