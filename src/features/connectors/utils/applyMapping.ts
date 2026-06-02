/**
 * applyMapping — Transform fetched rows into sheet-ready cell data.
 *
 * Takes a `FetchResult` + a `ColumnMapping[]` and returns an array of
 * `{ r, c, v }` cell objects compatible with FortuneSheet's `celldata` format.
 *
 * The caller is responsible for writing these cells into the sheet via
 * `useSheetStore.getState().replaceGridSheets(...)` using the
 * `cloneSheetWithData` helper (the same pattern used by sort, filter, etc.).
 *
 * @param result   - The data returned by a connector's `fetch()` call.
 * @param mapping  - Column mappings from the saved `ConnectorConnection`.
 * @param startRow - 0-based sheet row to begin writing (default 0).
 *
 * @returns An array of `{ r, c, v }` objects ready for insertion into
 *          a FortuneSheet `Sheet.celldata` array.
 */

import type { FetchResult, ColumnMapping, CellValue } from '../types'

export interface MappedCell {
  r: number
  c: number
  v: {
    v: CellValue
    m: string
    ct?: { fa: string; t: 'n' | 's' | 'g' }
  }
}

/** Apply a single transform to a raw value. */
function applyTransform(
  raw: CellValue,
  transform: ColumnMapping['transform']
): CellValue {
  if (raw === null || raw === undefined) return null
  switch (transform) {
    case 'number': {
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw
      const s = String(raw).toLowerCase().trim()
      return s === 'true' || s === '1' || s === 'yes'
    }
    case 'date': {
      // Store as ISO string; FortuneSheet renders via number format
      const d = new Date(String(raw))
      return Number.isNaN(d.getTime()) ? String(raw) : d.toISOString()
    }
    case 'string':
      return String(raw)
    default:
      return raw
  }
}

/** Build the FortuneSheet cell type token from a transform hint. */
function cellType(transform: ColumnMapping['transform']): 'n' | 's' | 'g' | undefined {
  switch (transform) {
    case 'number':
    case 'date':
      return 'n'
    case 'boolean':
      // FortuneSheet has no dedicated boolean type — store as general text
      return 'g'
    case 'string':
      return 's'
    default:
      return undefined
  }
}

/** Format a CellValue for display (`m` field). */
function toDisplayString(v: CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

/**
 * Convert fetched rows + column mappings into FortuneSheet cell objects.
 *
 * @param result    - Connector fetch result.
 * @param mapping   - Ordered list of column mappings.
 * @param startRow  - 0-based row offset in the destination sheet.
 * @param includeHeader - If true, write `result.columns` as a header row at `startRow`.
 */
export function applyMapping(
  result: FetchResult,
  mapping: ColumnMapping[],
  startRow = 0,
  includeHeader = true
): MappedCell[] {
  const cells: MappedCell[] = []

  // Write header row
  if (includeHeader && result.columns.length > 0) {
    for (const map of mapping) {
      const headerValue = result.columns[
        result.columns.indexOf(map.sourceField)
      ] ?? map.sourceField

      cells.push({
        r: startRow,
        c: map.targetColumn,
        v: {
          v: headerValue,
          m: headerValue,
          ct: { fa: '@', t: 's' },
        },
      })
    }
  }

  const dataStartRow = includeHeader ? startRow + 1 : startRow

  // Write data rows
  result.rows.forEach((row, rowIdx) => {
    for (const map of mapping) {
      const colIdx = result.columns.indexOf(map.sourceField)
      if (colIdx === -1) continue

      const rawValue = row[colIdx] ?? null
      const transformed = applyTransform(rawValue, map.transform)
      const t = cellType(map.transform)

      const cell: MappedCell = {
        r: dataStartRow + rowIdx,
        c: map.targetColumn,
        v: {
          v: transformed,
          m: toDisplayString(transformed),
          ...(t ? { ct: { fa: t === 'n' ? 'General' : t === 's' ? '@' : 'General', t } } : {}),
        },
      }

      cells.push(cell)
    }
  })

  return cells
}

/**
 * Build a default identity mapping: every source field mapped to consecutive
 * sheet columns starting at 0.
 *
 * Useful for the wizard's "auto-map" step when a user hasn't customised mapping.
 */
export function buildDefaultMapping(columns: string[]): ColumnMapping[] {
  return columns.map((col, idx) => ({
    sourceField: col,
    targetColumn: idx,
  }))
}
