/**
 * Outline (row grouping) — Excel's Data > Outline > Group / Ungroup.
 *
 * Each group is a contiguous range of rows on a given sheet, with a
 * nesting `level` (1 = outermost). When `collapsed` is true the rows
 * inside the group are hidden via the sheet's `config.rowhidden` map.
 *
 * Storage is in-memory only (Zustand) — matches the pattern set by
 * `useColumnTypesStore` for session-scoped feature state. Persistence
 * to Supabase / localStorage is intentionally deferred (out of scope
 * per the launch plan).
 */

/** A single group covering rows `[startRow, endRow]` (inclusive) on one sheet. */
export interface RowGroup {
  /** Stable UUID-ish identifier; generated on `addGroup`. */
  id: string
  /** Sheet this group lives on. */
  sheetId: string
  /** Inclusive first row index. */
  startRow: number
  /** Inclusive last row index. */
  endRow: number
  /** Nesting level — 1 for outermost. Used to render indented markers. */
  level: number
  /** Whether the rows inside the group are currently hidden. */
  collapsed: boolean
}
