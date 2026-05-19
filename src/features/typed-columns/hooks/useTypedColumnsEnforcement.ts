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

  // Hydrate on workbook change.
  useEffect(() => {
    if (workbookId) loadFromWorkbook(workbookId)
  }, [workbookId, loadFromWorkbook])

  // Reapply display formatting when column types change.
  useEffect(() => {
    const sheetState = useSheetStore.getState()
    const workbookState = useWorkbookStore.getState()
    const { gridSheets, replaceGridSheets } = sheetState

    if (gridSheets.length === 0) return

    let didChange = false
    const nextSheets: Sheet[] = gridSheets.map((sheet) => {
      const sheetId = typeof sheet.id === 'string' ? sheet.id : null
      if (!sheetId) return sheet
      const colMap = byWorkbook[sheetId]
      if (!colMap || Object.keys(colMap).length === 0) return sheet

      const matrix = getSheetMatrix(sheet)
      let sheetChanged = false
      const nextMatrix = matrix.map((row, _r) =>
        (row ?? []).map((cell, c) => {
          const meta = colMap[String(c)]
          if (!meta || !cell) return cell
          const raw = (cell as { v?: unknown }).v
          if (raw === null || raw === undefined || raw === '') return cell
          const newDisplay = formatForDisplay(raw, meta)
          const current = (cell as { m?: string }).m
          if (current === newDisplay) return cell
          sheetChanged = true
          return { ...(cell as Cell), m: newDisplay }
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
