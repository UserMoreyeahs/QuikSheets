'use client'

/**
 * useTypedColumnsEnforcement — bridges the column-types store with the
 * live FortuneSheet grid.
 *
 * Two concerns:
 *
 *   1. Hydration on workbook open: read localStorage into the store.
 *   2. Display reformatting: when any column type changes, walk the
 *      affected sheet's cells and rewrite their `m` (display) field so
 *      values render in the configured format.
 *
 * Validation on edit happens elsewhere (in the cell-change handler that
 * the page wires up) — this hook deliberately stays narrow.
 */

import { useEffect } from 'react'
import { useColumnTypesStore } from '../store/columnTypesStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { formatForDisplay } from '../utils/columnTypeFormatters'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import type { Cell, Sheet } from '@fortune-sheet/core'

/**
 * Hook for the sheet page. Pass the current workbookId; the hook:
 *  - Loads column-type metadata from localStorage once on mount.
 *  - Subscribes to store changes and reformats display cells when a
 *    column's type meta changes.
 */
export function useTypedColumnsEnforcement(workbookId: string): void {
  const loadFromWorkbook = useColumnTypesStore((s) => s.loadFromWorkbook)
  const byWorkbook = useColumnTypesStore((s) => s.byWorkbook)

  // Hydrate on workbook change (loadFromWorkbook is now async — fire and forget).
  useEffect(() => {
    if (workbookId) void loadFromWorkbook(workbookId)
  }, [workbookId, loadFromWorkbook])

  // Reapply display formatting when column types change.
  //
  // Walk every column on every sheet — NOT just the typed ones — because
  // clearing a type also needs to revert the cell's display field back to
  // the raw value. The previous version short-circuited when a sheet had
  // no type map, which left the formatted display (e.g. ☑ for checkbox)
  // baked into every cell long after the column type was removed. The
  // user would see checkboxes forever with no way to recover except
  // editing each cell by hand.
  useEffect(() => {
    const sheetState = useSheetStore.getState()
    const workbookState = useWorkbookStore.getState()
    const { gridSheets, replaceGridSheets } = sheetState

    if (gridSheets.length === 0) return

    /** Display strings that the typed-columns formatter is known to emit.
     *  When a cell's `m` matches one of these AND the column is no longer
     *  typed, we know the formatter wrote it and it's safe to drop. */
    const formatterOutputs = new Set(['☑', '☐'])

    let didChange = false
    const nextSheets: Sheet[] = gridSheets.map((sheet) => {
      const sheetId = typeof sheet.id === 'string' ? sheet.id : null
      if (!sheetId) return sheet
      const colMap = byWorkbook[sheetId] ?? {}

      const matrix = getSheetMatrix(sheet)
      let sheetChanged = false
      const nextMatrix = matrix.map((row, _r) =>
        (row ?? []).map((cell, c) => {
          if (!cell) return cell
          const meta = colMap[String(c)]
          const raw = (cell as { v?: unknown }).v
          if (raw === null || raw === undefined || raw === '') return cell
          const current = (cell as { m?: string }).m

          if (meta) {
            // Apply current type's formatting.
            const newDisplay = formatForDisplay(raw, meta)
            if (current === newDisplay) return cell
            sheetChanged = true
            return { ...(cell as Cell), m: newDisplay }
          }

          // No meta for this column. If `m` looks like a formatter output
          // we recognise (e.g. checkbox ☑/☐), drop it so FortuneSheet
          // re-renders from `v + ct`.
          if (current && formatterOutputs.has(current) && current !== String(raw)) {
            sheetChanged = true
            const next: Record<string, unknown> = { ...(cell as Cell) }
            delete next.m
            return next as Cell
          }
          return cell
        }),
      )

      if (!sheetChanged) return sheet
      didChange = true
      return cloneSheetWithData(sheet, nextMatrix as Cell[][])
    })

    if (didChange) {
      replaceGridSheets(nextSheets)
    }
    void workbookState
  }, [byWorkbook])
}
