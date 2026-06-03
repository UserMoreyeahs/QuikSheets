'use client'

/**
 * Zustand store for per-column type metadata.
 *
 * Persistence: Supabase-first (via columnTypesApi), localStorage fallback.
 * The previous implementation wrote directly to localStorage; columnTypesApi
 * preserves that as the offline path so nothing breaks in demo / unauthenticated
 * mode.
 *
 * Shape in memory: `{ [sheetId]: { [colIndex]: ColumnTypeMeta } }`.
 *
 * Why a separate store (not in sheetStore):
 *   - Column-type metadata is workbook-scoped, not session state.
 *   - Decouples persistence — sheetStore is grid data, this is a config layer.
 *   - Mirrors the pattern of cfStore and namedRangesStore.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ColumnType, ColumnTypeMeta } from '../types'
import {
  loadColumnTypes,
  setColumnType as apiSetColumnType,
  clearColumnType as apiClearColumnType,
  type WorkbookColumnMap,
} from '@/lib/columnTypesApi'

type SheetColumnMap = Record<string, ColumnTypeMeta>

interface ColumnTypesState {
  workbookId: string | null
  /** All column-type metadata, keyed by sheetId then colIndex (as string). */
  byWorkbook: WorkbookColumnMap
}

interface ColumnTypesActions {
  /** Hydrate from Supabase (with localStorage fallback) on workbook load. */
  loadFromWorkbook: (workbookId: string) => Promise<void>
  /** Get the type meta for a single column (returns undefined if untyped). */
  getColumnType: (sheetId: string, colIndex: number) => ColumnTypeMeta | undefined
  /** Set the type (and optional options) for an entire column. */
  setColumnType: (sheetId: string, colIndex: number, meta: ColumnTypeMeta) => void
  /** Remove the type — column reverts to plain text. */
  clearColumnType: (sheetId: string, colIndex: number) => void
  /** Return the full sheet map (used by validation / renderers). */
  getSheetMap: (sheetId: string) => SheetColumnMap
}

export const useColumnTypesStore = create<ColumnTypesState & ColumnTypesActions>()(
  devtools(
    (set, get) => ({
      workbookId: null,
      byWorkbook: {},

      async loadFromWorkbook(workbookId) {
        // Load from Supabase (falls back to localStorage inside columnTypesApi).
        const loaded = await loadColumnTypes(workbookId)
        set({ workbookId, byWorkbook: loaded }, false, 'columnTypes/load')
      },

      getColumnType(sheetId, colIndex) {
        return get().byWorkbook[sheetId]?.[String(colIndex)]
      },

      setColumnType(sheetId, colIndex, meta) {
        set(
          (state) => {
            const sheet = { ...(state.byWorkbook[sheetId] ?? {}) }
            sheet[String(colIndex)] = meta
            const next = { ...state.byWorkbook, [sheetId]: sheet }
            // Persist async — do not block the store update.
            if (state.workbookId) {
              void apiSetColumnType(state.workbookId, sheetId, colIndex, meta)
            }
            return { byWorkbook: next }
          },
          false,
          'columnTypes/set',
        )
      },

      clearColumnType(sheetId, colIndex) {
        set(
          (state) => {
            const sheet = { ...(state.byWorkbook[sheetId] ?? {}) }
            delete sheet[String(colIndex)]
            const next = { ...state.byWorkbook, [sheetId]: sheet }
            // Persist async — do not block the store update.
            if (state.workbookId) {
              void apiClearColumnType(state.workbookId, sheetId, colIndex)
            }
            return { byWorkbook: next }
          },
          false,
          'columnTypes/clear',
        )
      },

      getSheetMap(sheetId) {
        return get().byWorkbook[sheetId] ?? {}
      },
    }),
    { name: 'ColumnTypesStore' },
  ),
)

/** Convenience selector — re-export ColumnType for consumers. */
export type { ColumnType, ColumnTypeMeta }
