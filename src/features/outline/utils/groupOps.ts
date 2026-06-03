/**
 * Pure helpers for row grouping (Data > Outline).
 *
 * These functions never touch FortuneSheet state directly; they compute
 * derived sets that the store + grid consume.
 */

import type { RowGroup } from '../types'

/**
 * Compute the set of rows hidden purely because a containing group is
 * `collapsed`. Rows are hidden ONLY between `startRow` and `endRow`
 * (inclusive) — the row at `startRow` (the "summary" row in Excel
 * parlance) stays visible so the user has somewhere to anchor the +/-
 * marker. This matches Excel's "summary rows below detail" default.
 *
 * Actually, Excel's default is "summary rows below" which would keep
 * `endRow + 1`. For simplicity and so the marker remains anchored at
 * `startRow`, we hide rows in `[startRow + 1, endRow]`. This is the
 * same choice Google Sheets makes for an ungrouped sheet.
 */
export function computeGroupHiddenRows(groups: RowGroup[]): Set<number> {
  const hidden = new Set<number>()
  for (const group of groups) {
    if (!group.collapsed) continue
    // Hide every row inside the group except the first one — the first
    // row stays as the visible anchor for the +/- marker.
    for (let row = group.startRow + 1; row <= group.endRow; row += 1) {
      hidden.add(row)
    }
  }
  return hidden
}

/**
 * Find the maximum nesting level for a new group spanning
 * `[startRow, endRow]` on a sheet. A new group nested fully inside an
 * existing group bumps its level by one.
 */
export function computeNestedLevel(
  existingGroups: RowGroup[],
  startRow: number,
  endRow: number,
): number {
  let level = 1
  for (const group of existingGroups) {
    if (group.startRow <= startRow && group.endRow >= endRow) {
      level = Math.max(level, group.level + 1)
    }
  }
  return level
}

/**
 * Detect whether two ranges overlap but neither fully contains the
 * other. Excel allows fully-nested or fully-disjoint groups but rejects
 * partial overlaps.
 */
export function hasPartialOverlap(
  groups: RowGroup[],
  startRow: number,
  endRow: number,
): boolean {
  return groups.some((group) => {
    const disjoint = group.endRow < startRow || group.startRow > endRow
    if (disjoint) return false
    const aContainsB = group.startRow <= startRow && group.endRow >= endRow
    const bContainsA = startRow <= group.startRow && endRow >= group.endRow
    return !aContainsB && !bContainsA
  })
}

/**
 * Find the deepest group on the sheet that fully covers
 * `[startRow, endRow]`. Returned group is the one Ungroup should
 * remove when the user selects a sub-range within it.
 */
export function findInnermostGroup(
  groups: RowGroup[],
  startRow: number,
  endRow: number,
): RowGroup | null {
  let best: RowGroup | null = null
  for (const group of groups) {
    if (group.startRow <= startRow && group.endRow >= endRow) {
      if (!best || group.level > best.level) {
        best = group
      }
    }
  }
  return best
}
