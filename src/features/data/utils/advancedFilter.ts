'use client'

/**
 * Excel-style Advanced Filter — parser + evaluator.
 *
 * Excel's Advanced Filter takes:
 *  - a **list range** (the table to filter, including its header row)
 *  - a **criteria range** elsewhere on the sheet whose first row mirrors
 *    the list header and whose subsequent rows hold the conditions.
 *
 * Within the criteria range:
 *  - Cells in the SAME row are AND-ed
 *  - Cells across DIFFERENT rows are OR-ed
 *
 *      Region | Sales
 *      West   | >100
 *      East   | >200
 *
 *  ⇒ (Region=West AND Sales>100) OR (Region=East AND Sales>200)
 *
 * Supported criteria expressions (intentionally modest — Excel itself
 * supports formulas inside criteria, which we omit on purpose):
 *  - `=value`     exact match (case-insensitive)
 *  - `>n` `<n` `>=n` `<=n`     numeric comparison
 *  - `<>value`    not equal
 *  - `value*`     starts with (case-insensitive)
 *  - `*value`     ends with (case-insensitive)
 *  - `*value*`    contains (case-insensitive)
 *  - empty cell   no condition (matches everything)
 *  - plain value  exact match (case-insensitive)
 *
 * Numbers parse from the input string with `Number(x)` and the cell
 * value is also coerced with `Number()` — if either side is NaN the
 * numeric comparators all return false.
 */

import { fromCellNotation, colIndexToLetter } from '@/lib/cellAddress'

export interface RangeCoords {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

/**
 * Parse Excel A1-notation range like "A1:E15" into row/col coords.
 * Throws if the input isn't a valid range. Single-cell input ("A1") is
 * accepted and treated as a 1x1 range.
 */
export function parseA1Range(text: string): RangeCoords {
  const trimmed = text.trim().replace(/\$/g, '')
  if (!trimmed) throw new Error('Range is empty')

  const parts = trimmed.split(':')
  if (parts.length === 1) {
    const cell = fromCellNotation(parts[0]!.toUpperCase())
    return { startRow: cell.row, endRow: cell.row, startCol: cell.col, endCol: cell.col }
  }

  if (parts.length !== 2) throw new Error(`Invalid range: ${text}`)
  const a = fromCellNotation(parts[0]!.toUpperCase())
  const b = fromCellNotation(parts[1]!.toUpperCase())

  return {
    startRow: Math.min(a.row, b.row),
    endRow:   Math.max(a.row, b.row),
    startCol: Math.min(a.col, b.col),
    endCol:   Math.max(a.col, b.col),
  }
}

/** Format range coords back to A1:B2 form (used by the dialog defaults). */
export function formatA1Range(coords: RangeCoords): string {
  const a = `${colIndexToLetter(coords.startCol)}${coords.startRow + 1}`
  const b = `${colIndexToLetter(coords.endCol)}${coords.endRow + 1}`
  return a === b ? a : `${a}:${b}`
}

// ─── Criteria interpretation ───────────────────────────────────────────

type CellLike = string | number | boolean | null | undefined

function cellToString(value: CellLike): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return String(value)
  return String(value).trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Evaluate ONE criterion cell against ONE data cell value.
 * Returns true if the data cell satisfies the criterion expression.
 * An empty criterion always returns true (Excel skips empty cells).
 */
export function evaluateCriterion(criterion: CellLike, cellValue: CellLike): boolean {
  const expr = cellToString(criterion)
  if (expr === '') return true

  const dataStr = cellToString(cellValue)
  const dataLower = dataStr.toLowerCase()

  // Comparison operators: order matters — match >= and <= before > and <.
  for (const op of ['>=', '<=', '<>', '>', '<', '=']) {
    if (expr.startsWith(op)) {
      const rhs = expr.slice(op.length).trim()
      if (op === '=') {
        return dataLower === rhs.toLowerCase()
      }
      if (op === '<>') {
        return dataLower !== rhs.toLowerCase()
      }
      // Numeric comparators
      const n = Number(dataStr)
      const r = Number(rhs)
      if (!Number.isFinite(n) || !Number.isFinite(r)) return false
      if (op === '>') return n > r
      if (op === '<') return n < r
      if (op === '>=') return n >= r
      if (op === '<=') return n <= r
    }
  }

  // Wildcard match (* only — ? not supported to keep parsing modest).
  if (expr.includes('*')) {
    const pattern = expr
      .split('*')
      .map((part) => escapeRegExp(part))
      .join('.*')
    const regex = new RegExp(`^${pattern}$`, 'i')
    return regex.test(dataStr)
  }

  // Plain value → exact match (case-insensitive).
  return dataLower === expr.toLowerCase()
}

// ─── Row evaluation ────────────────────────────────────────────────────

export interface CriteriaBlock {
  /** Column indices in the data (mapped from criteria headers). */
  columnIndices: Array<number | null>
  /** Each row of criterion cells, by index in `columnIndices`. */
  conditionRows: Array<CellLike[]>
}

/**
 * Build a CriteriaBlock from the criteria range header + condition rows.
 * The `criteriaHeaders` and `dataHeaders` are matched case-insensitively;
 * headers in criteria with no match in data become `null` in
 * columnIndices and the corresponding criterion cells are ignored
 * (Excel rejects this scenario outright; we keep it permissive).
 */
export function buildCriteriaBlock(
  criteriaHeaders: CellLike[],
  conditionRows: CellLike[][],
  dataHeaders: CellLike[]
): CriteriaBlock {
  const normalizedDataHeaders = dataHeaders.map((h) => cellToString(h).toLowerCase())
  const columnIndices = criteriaHeaders.map((h) => {
    const needle = cellToString(h).toLowerCase()
    if (needle === '') return null
    const idx = normalizedDataHeaders.indexOf(needle)
    return idx >= 0 ? idx : null
  })

  return { columnIndices, conditionRows }
}

/**
 * Evaluate one data row against the criteria block.
 * Same row in criteria = AND, different rows in criteria = OR.
 * Returns true if the row matches ANY condition row.
 */
export function rowMatchesCriteria(
  dataRow: CellLike[],
  block: CriteriaBlock
): boolean {
  if (block.conditionRows.length === 0) return true

  for (const conditionRow of block.conditionRows) {
    const allMatch = block.columnIndices.every((colIdx, criterionIdx) => {
      if (colIdx === null) return true
      const criterion = conditionRow[criterionIdx]
      const dataCell = dataRow[colIdx]
      return evaluateCriterion(criterion, dataCell)
    })
    if (allMatch) return true
  }
  return false
}

// ─── Public API ────────────────────────────────────────────────────────

export interface AdvancedFilterCriteria {
  /** A1-notation list range (data area incl. header), e.g. "A1:E15". */
  listRange: string
  /** A1-notation criteria range (header + condition rows), e.g. "A20:B22". */
  criteriaRange: string
}

export interface AdvancedFilterResult {
  /** 0-based row indices in the sheet matrix that the filter HIDES. */
  hiddenRows: number[]
  /** Number of data rows (excluding header) that the filter matched. */
  matchedRowCount: number
  /** Number of data rows considered. */
  totalDataRows: number
}

/**
 * Run an Advanced Filter against the sheet matrix.
 * Returns the row indices to hide so the caller can set `config.rowhidden`.
 * Throws on invalid range/criteria input — the dialog catches and toasts.
 */
export function evaluateAdvancedFilter(
  sheetMatrix: CellLike[][],
  criteria: AdvancedFilterCriteria
): AdvancedFilterResult {
  const list = parseA1Range(criteria.listRange)
  const crit = parseA1Range(criteria.criteriaRange)

  // List range must have at least 1 header row and 1 data row.
  if (list.endRow <= list.startRow) {
    throw new Error('List range must include a header row and at least one data row.')
  }

  // Criteria range must have at least 1 header row and 1 condition row.
  if (crit.endRow <= crit.startRow) {
    throw new Error('Criteria range must include a header row and at least one condition row.')
  }

  // Extract headers from the list range (its first row).
  const listHeaders: CellLike[] = []
  for (let c = list.startCol; c <= list.endCol; c++) {
    listHeaders.push(sheetMatrix[list.startRow]?.[c] ?? null)
  }

  // Extract headers from the criteria range (its first row).
  const criteriaHeaders: CellLike[] = []
  for (let c = crit.startCol; c <= crit.endCol; c++) {
    criteriaHeaders.push(sheetMatrix[crit.startRow]?.[c] ?? null)
  }

  // Extract condition rows from the criteria range (rows after header).
  const conditionRows: CellLike[][] = []
  for (let r = crit.startRow + 1; r <= crit.endRow; r++) {
    const row: CellLike[] = []
    for (let c = crit.startCol; c <= crit.endCol; c++) {
      row.push(sheetMatrix[r]?.[c] ?? null)
    }
    // Skip wholly-empty condition rows so a 5-row criteria range with 2
    // filled rows + 3 blanks doesn't degenerate into "match everything".
    if (row.some((v) => cellToString(v) !== '')) {
      conditionRows.push(row)
    }
  }

  // Map criteria headers → data columns by name.
  // Build the block in terms of absolute (sheet) column indices so we
  // can index directly into sheetMatrix rows below.
  const normalizedListHeaders = listHeaders.map((h) => cellToString(h).toLowerCase())
  const block: CriteriaBlock = {
    columnIndices: criteriaHeaders.map((h) => {
      const needle = cellToString(h).toLowerCase()
      if (needle === '') return null
      const relIdx = normalizedListHeaders.indexOf(needle)
      return relIdx >= 0 ? list.startCol + relIdx : null
    }),
    conditionRows,
  }

  const hiddenRows: number[] = []
  let matchedRowCount = 0
  const totalDataRows = list.endRow - list.startRow

  // Iterate data rows (skip the header at list.startRow).
  for (let r = list.startRow + 1; r <= list.endRow; r++) {
    // Build a row aligned to absolute column indices so block.columnIndices
    // (which holds absolute indices) reads from the right slot.
    const dataRow: CellLike[] = []
    for (let c = 0; c <= list.endCol; c++) {
      dataRow[c] = sheetMatrix[r]?.[c] ?? null
    }

    if (rowMatchesCriteria(dataRow, block)) {
      matchedRowCount += 1
    } else {
      hiddenRows.push(r)
    }
  }

  return { hiddenRows, matchedRowCount, totalDataRows }
}
