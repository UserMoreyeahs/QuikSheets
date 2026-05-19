'use client'

/**
 * Zustand store for per-column type metadata.
 *
 * Persistence: localStorage at `quiksheets_column_types:<workbookId>`.
 * Shape: `{ [sheetId]: { [colIndex]: ColumnTypeMeta } }`.
 *
 * Why a separate store (not in sheetStore):
 *   - Column-type metadata is workbook-scoped, not session state.
 *   - Decouples persistence — sheetStore is grid data, this is a config layer.
 *   - Mirrors the pattern of cfStore and namedRangesStore.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ColumnType, ColumnTypeMeta } from '../types'

const STORAGE_PREFIX = 'quiksheets_column_types:'

type SheetColumnMap = Record<string, ColumnTypeMeta>
type WorkbookColumnMap = Record<string, SheetColumnMap>

function loadFromStorage(workbookId: string): WorkbookColumnMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${workbookId}`)
    return raw ? (JSON.parse(raw) as WorkbookColumnMap) : {}
  } catch {
    return {}
  }
}

function saveToStorage(workbookId: string, data: WorkbookColumnMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${workbookId}`, JSON.stringify(data))
  } catch {
    /* localStorage unavailable / over quota */
  }
}

interface ColumnTypesState {
  workbookId: string | null
  /** All column-type metadata, keyed by sheetId then colIndex (as string). */
  byWorkbook: WorkbookColumnMap
}

interface ColumnTypesActions {
  /** Hydrate from localStorage on workbook load. */
  loadFromWorkbook: (workbookId: string) => void
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

      loadFromWorkbook(workbookId) {
        const stored = loadFromStorage(workbookId)
        set({ workbookId, byWorkbook: stored }, false, 'columnTypes/load')
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
            if (state.workbookId) saveToStorage(state.workbookId, next)
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
            if (state.workbookId) saveToStorage(state.workbookId, next)
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
