/**
 * Export-side CSV / Formula-Injection guard (OWASP "Formula Injection").
 *
 * When a victim opens an exported .csv / .xlsx in Excel, Google Sheets, or
 * Apple Numbers, any cell whose *text* begins with one of the formula-trigger
 * characters is interpreted as a live formula and may execute (e.g.
 * `=cmd|'/c calc'!A1`, `=HYPERLINK(...)`, `+WEBSERVICE(...)`, DDE payloads, …).
 *
 * The standard, lossless mitigation is to prefix the offending string with a
 * single apostrophe (`'`). Spreadsheet applications treat a leading apostrophe
 * as the "force text" marker: the cell shows the original text and is never
 * evaluated. The apostrophe is a display/formatting hint, not part of the
 * stored value, so round-tripping is safe.
 *
 * IMPORTANT — what this does NOT touch:
 *   - Non-string values (number / boolean / null / undefined / Date) pass
 *     through unchanged. A numeric `-5` or boolean `true` is never a formula.
 *   - Legitimate authored *formulas* (the FortuneSheet `cell.f` field) are
 *     deliberately NOT routed through here — those are real spreadsheet
 *     formulas the user wrote and must export as formulas. This guard only
 *     applies to cell *text/values* (`cell.v` / display strings) that an
 *     attacker could have seeded as plain text.
 *
 * Trigger characters (must match the leading character of the string):
 *   =  +  -  @            classic formula / function leads
 *   \t (tab)  \r (CR)     Excel strips a leading tab/CR and re-parses the
 *                         remainder, so `\t=cmd` becomes `=cmd`. \n is added
 *                         for the same defensive reason.
 *
 * This mirrors the import-side guard in `@/lib/security/csvInjection` but is
 * intentionally a self-contained copy so the export utility stays free of the
 * import module's dependency tree. The two should stay behaviourally aligned.
 *
 * Reference: OWASP "CSV Injection" / "Formula Injection".
 */

/** Characters that, as the FIRST character of a cell's text, can trigger
 *  formula evaluation in Excel / Sheets / Numbers when the file is opened. */
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r', '\n'])

/**
 * Neutralize a single cell value for export.
 *
 * @returns the value unchanged for non-strings and safe strings; a copy with a
 *          leading `'` prepended for strings that begin with a trigger char.
 */
export function sanitizeCellForExport<T>(value: T): T | string {
  // Only strings can carry a formula payload; everything else is inert.
  if (typeof value !== 'string') return value
  if (value.length === 0) return value
  const first = value[0]!
  if (FORMULA_TRIGGER_CHARS.has(first)) return `'${value}`
  return value
}

/** Apply {@link sanitizeCellForExport} to every cell in a single row. */
export function sanitizeRowForExport<T>(row: readonly T[]): (T | string)[] {
  return row.map((cell) => sanitizeCellForExport(cell))
}

/** Apply {@link sanitizeCellForExport} to every cell in a 2-D matrix. */
export function sanitizeMatrixForExport<T>(matrix: readonly (readonly T[])[]): (T | string)[][] {
  return matrix.map((row) => sanitizeRowForExport(row))
}
