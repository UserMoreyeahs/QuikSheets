'use client'

import { useEffect } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { useColumnTypesStore } from '@/features/typed-columns/store/columnTypesStore'
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import { useSlicerStore } from '@/features/slicers/store/slicerStore'
import { useNamedRangesStore } from '@/features/named-ranges/namedRangesStore'
import { useCFStore } from '@/features/conditional-formatting/store/cfStore'
import { parseClipboardText } from '@/features/smart-paste/utils/clipboardParser'

/**
 * Dev-only `window.__qs*` test-surface helpers.
 *
 * In non-production builds, exposes a set of accessors on `window` so
 * headless smoke tests / dev consoles can drive features without going
 * through window.prompt / DOM-event flow:
 *
 *   __qsGrid            — live FortuneSheet WorkbookInstance
 *   __qsSeed            — seed the active sheet with a 2-D values array
 *   __qsSetColType      — set a typed-column type
 *   __qsClearColType    — clear a typed-column type
 *   __qsListPivots      — return pivot list [{id, name}]
 *   __qsParseClipboard  — run the smart-paste clipboard parser
 *   __qsAddSlicer       — append a slicer to a pivot
 *   __qsAddName         — define a named range for the active workbook
 *   __qsListNames       — list defined names for the active workbook
 *   __qsAddFilter       — add a column filter
 *   __qsClearFilters    — clear all filters
 *   __qsAddCFGreaterThan— add a CF rule + apply on the current sheet
 *
 * Gated on `process.env.NODE_ENV !== 'production'`. The entire effect
 * short-circuits in production so the helpers — and their imports —
 * are dead-code-eliminated by the bundler.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useDevWindowHelpers(workbookId: string): void {
  const gridInstance = useSheetStore((s) => s.gridInstance)
  const activeSheetId = useWorkbookStore((s) => s.activeSheetId)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    ;(window as unknown as { __qsGrid?: unknown }).__qsGrid = gridInstance

    ;(window as unknown as { __qsSeed?: (rows: unknown[][]) => void }).__qsSeed = (rows) => {
      const state = useSheetStore.getState()
      const sheets = state.gridSheets.length ? state.gridSheets : [{ id: activeSheetId, name: 'Sheet1', status: 1 }]
      const targetSheetIdx = Math.max(0, sheets.findIndex((s) => s.status === 1))
      const target = sheets[targetSheetIdx]
      if (!target) {
        return
      }
      const buildCell = (v: unknown) =>
        v === null || v === undefined
          ? null
          : typeof v === 'number'
            ? { ct: { fa: 'General', t: 'n' }, m: String(v), v }
            : { ct: { fa: 'General', t: 'g' }, m: String(v), v: String(v) }
      const celldata = rows.flatMap((row, r) =>
        row.map((v, c) => ({ r, c, v: buildCell(v) })).filter((e) => e.v !== null),
      )
      // Also populate the 2-D `data` matrix because FortuneSheet renders
      // from `data`, not celldata, when the workbook is hydrated via the
      // `data` prop. Build a 100x26 matrix (default sheet size).
      const ROWS = 100
      const COLS = 26
      const matrix: (ReturnType<typeof buildCell> | null)[][] = Array.from(
        { length: ROWS },
        () => Array<ReturnType<typeof buildCell> | null>(COLS).fill(null),
      )
      rows.forEach((row, r) => {
        if (r >= ROWS) return
        row.forEach((v, c) => {
          if (c >= COLS) return
          matrix[r]![c] = buildCell(v)
        })
      })
      const nextSheets = sheets.map((s, i) =>
        i === targetSheetIdx
          ? ({ ...s, celldata, data: matrix } as typeof s)
          : s,
      )
      state.replaceGridSheets(nextSheets)
    }

    // Dev helpers — verification surface that mirrors the real stores
    // so scripted tests can drive features without window.prompt() etc.
    ;(window as unknown as { __qsSetColType?: (sheetId: string, col: number, type: string) => void }).__qsSetColType =
      (sheetId, col, type) => useColumnTypesStore.getState().setColumnType(sheetId, col, { type: type as never })
    ;(window as unknown as { __qsClearColType?: (sheetId: string, col: number) => void }).__qsClearColType =
      (sheetId, col) => useColumnTypesStore.getState().clearColumnType(sheetId, col)
    ;(window as unknown as { __qsListPivots?: () => Array<{ id: string; name: string }> }).__qsListPivots = () =>
      usePivotUiStore.getState().pivots.map((p) => ({ id: p.id, name: p.name }))
    ;(window as unknown as { __qsParseClipboard?: (text: string) => unknown }).__qsParseClipboard = (text) =>
      parseClipboardText(text)
    ;(window as unknown as { __qsAddSlicer?: (pivotId: string, columnIndex: number, label: string, allValues: string[]) => string }).__qsAddSlicer =
      (pivotId, columnIndex, label, allValues) =>
        useSlicerStore.getState().addSlicer({
          label, kind: 'list', pivotId, columnIndex, allValues,
          selected: [], x: 200, y: 600, width: 200, height: 240,
        })
    ;(window as unknown as { __qsAddName?: (name: string, range: string) => void }).__qsAddName =
      (name, range) => useNamedRangesStore.getState().addName(workbookId, { name, range, scope: 'workbook' })
    ;(window as unknown as { __qsListNames?: () => Array<{ name: string; range: string }> }).__qsListNames = () =>
      useNamedRangesStore.getState().getNamesForWorkbook(workbookId) as unknown as Array<{ name: string; range: string }>
    ;(window as unknown as { __qsAddFilter?: (col: number, operator: string, value: string) => void }).__qsAddFilter =
      (col, operator, value) => useSheetStore.getState().addFilter({ columnIndex: col, operator: operator as never, value })
    ;(window as unknown as { __qsClearFilters?: () => void }).__qsClearFilters = () => useSheetStore.getState().clearFilters()
    ;(window as unknown as { __qsAddCFGreaterThan?: (sheetId: string, range: string, threshold: number, bgColor: string) => void }).__qsAddCFGreaterThan =
      (sheetId, range, threshold, bgColor) => {
        useCFStore.getState().addRule(sheetId, {
          range,
          condition: { type: 'cell_value', operator: 'greater', value: String(threshold) },
          format: { fill: bgColor },
          priority: 0,
        })
        useCFStore.getState().applyToActiveSheet()
      }
  }, [gridInstance, activeSheetId, workbookId])
}
