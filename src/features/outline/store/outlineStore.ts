'use client'

/**
 * Zustand store for row outline (group / ungroup) state.
 *
 * In-memory only — mirrors the typed-columns pattern. Persistence to
 * Supabase or localStorage is intentionally out of scope for this MVP
 * feature; the launch plan says "match the in-memory pattern for
 * typed-columns".
 *
 * Shape: `{ [sheetId]: RowGroup[] }`. Each group knows its row span,
 * nesting level, and collapsed state.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  computeGroupHiddenRows,
  computeNestedLevel,
  findInnermostGroup,
  hasPartialOverlap,
} from '../utils/groupOps'
import type { RowGroup } from '../types'

type SheetGroupMap = Record<string, RowGroup[]>

interface OutlineState {
  /** All row groups, keyed by sheetId. */
  groupsBySheet: SheetGroupMap
}

interface OutlineActions {
  /**
   * Add a new group covering `[startRow, endRow]` on the given sheet.
   * Returns `{ ok: true, group }` on success or `{ ok: false, reason }`
   * if the range partially overlaps an existing group (Excel forbids
   * this).
   */
  addGroup: (
    sheetId: string,
    startRow: number,
    endRow: number,
  ) => { ok: true; group: RowGroup } | { ok: false; reason: string }
  /**
   * Remove the innermost group containing `[startRow, endRow]` on the
   * given sheet. Returns the removed group or `null` if no group
   * contained the range.
   */
  removeGroup: (
    sheetId: string,
    startRow: number,
    endRow: number,
  ) => RowGroup | null
  /** Remove a specific group by ID. Used by the marker close icon. */
  removeGroupById: (sheetId: string, groupId: string) => void
  /** Toggle the collapsed flag on a specific group. */
  toggleCollapse: (sheetId: string, groupId: string) => void
  /** Get the groups on a sheet (returns [] if none). */
  getGroups: (sheetId: string) => RowGroup[]
  /**
   * Get the set of rows hidden purely due to a collapsed group on
   * a sheet. Caller is responsible for merging with filter-hidden rows.
   */
  getHiddenRows: (sheetId: string) => Set<number>
  /** Reset all outline state — used by tests and workbook reset. */
  reset: () => void
}

function generateGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const initialState: OutlineState = {
  groupsBySheet: {},
}

export const useOutlineStore = create<OutlineState & OutlineActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      addGroup: (sheetId, startRow, endRow) => {
        const normalizedStart = Math.min(startRow, endRow)
        const normalizedEnd = Math.max(startRow, endRow)

        if (normalizedStart < 0 || normalizedEnd < 0) {
          return { ok: false, reason: 'Invalid row range.' }
        }
        if (normalizedStart === normalizedEnd) {
          return {
            ok: false,
            reason: 'Select at least two rows to group.',
          }
        }

        const existing = get().groupsBySheet[sheetId] ?? []

        // Reject identical-range duplicate.
        if (
          existing.some(
            (group) =>
              group.startRow === normalizedStart &&
              group.endRow === normalizedEnd,
          )
        ) {
          return { ok: false, reason: 'This range is already grouped.' }
        }

        if (hasPartialOverlap(existing, normalizedStart, normalizedEnd)) {
          return {
            ok: false,
            reason:
              'Groups can be nested or disjoint, but cannot partially overlap.',
          }
        }

        const level = computeNestedLevel(
          existing,
          normalizedStart,
          normalizedEnd,
        )
        const group: RowGroup = {
          id: generateGroupId(),
          sheetId,
          startRow: normalizedStart,
          endRow: normalizedEnd,
          level,
          collapsed: false,
        }

        set(
          (state) => ({
            groupsBySheet: {
              ...state.groupsBySheet,
              [sheetId]: [...existing, group],
            },
          }),
          false,
          'outline/addGroup',
        )

        return { ok: true, group }
      },

      removeGroup: (sheetId, startRow, endRow) => {
        const normalizedStart = Math.min(startRow, endRow)
        const normalizedEnd = Math.max(startRow, endRow)

        const existing = get().groupsBySheet[sheetId] ?? []
        const target = findInnermostGroup(
          existing,
          normalizedStart,
          normalizedEnd,
        )
        if (!target) return null

        set(
          (state) => ({
            groupsBySheet: {
              ...state.groupsBySheet,
              [sheetId]: (state.groupsBySheet[sheetId] ?? []).filter(
                (group) => group.id !== target.id,
              ),
            },
          }),
          false,
          'outline/removeGroup',
        )

        return target
      },

      removeGroupById: (sheetId, groupId) => {
        set(
          (state) => ({
            groupsBySheet: {
              ...state.groupsBySheet,
              [sheetId]: (state.groupsBySheet[sheetId] ?? []).filter(
                (group) => group.id !== groupId,
              ),
            },
          }),
          false,
          'outline/removeGroupById',
        )
      },

      toggleCollapse: (sheetId, groupId) => {
        set(
          (state) => ({
            groupsBySheet: {
              ...state.groupsBySheet,
              [sheetId]: (state.groupsBySheet[sheetId] ?? []).map((group) =>
                group.id === groupId
                  ? { ...group, collapsed: !group.collapsed }
                  : group,
              ),
            },
          }),
          false,
          'outline/toggleCollapse',
        )
      },

      getGroups: (sheetId) => get().groupsBySheet[sheetId] ?? [],

      getHiddenRows: (sheetId) =>
        computeGroupHiddenRows(get().groupsBySheet[sheetId] ?? []),

      reset: () =>
        set(() => ({ groupsBySheet: {} }), false, 'outline/reset'),
    }),
    { name: 'OutlineStore' },
  ),
)
