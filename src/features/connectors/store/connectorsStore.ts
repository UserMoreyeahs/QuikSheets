'use client'

/**
 * Connectors Zustand Store
 *
 * Manages the list of connector connections for the current workbook, the
 * builder dialog state, and sync operations.
 *
 * Persistence:
 *   connectorsApi handles Supabase + localStorage persistence. This store is
 *   the in-memory runtime state.
 *
 * Sync flow:
 *   1. `loadConnections(workbookId)` — called once on sheet page mount.
 *   2. `runSync(id)` — calls the connector's `fetch()`, applies mapping,
 *      writes cells into the active sheet via `sheetStore.replaceGridSheets`.
 *   3. `createConnection / updateConnection / deleteConnection` — mutate state
 *      and persist via connectorsApi.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  ConnectorConnection,
  ConnectorsStoreState,
  ConnectorsStoreActions,
} from '../types'
import { getConnector } from '../connectors/index'
import { applyMapping, buildDefaultMapping } from '../utils/applyMapping'
import {
  loadConnections as apiLoad,
  saveConnection as apiSave,
  deleteConnection as apiDelete,
  updateLastSynced as apiUpdateLastSynced,
  migrateLocalConnectionsToSupabase,
} from '@/lib/connectorsApi'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { cloneSheetWithData, getSheetMatrix } from '@/lib/fortuneSheet'
import type { Cell, CellMatrix, Sheet } from '@fortune-sheet/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useConnectorsStore = create<ConnectorsStoreState & ConnectorsStoreActions>()(
  devtools(
    (set, get) => ({
      // --- State ---
      connections: [],
      builderOpen: false,
      activeConnectionId: null,
      syncing: {},
      syncErrors: {},

      // --- Actions ---

      async loadConnections(workbookId: string) {
        const connections = await apiLoad(workbookId)
        set({ connections }, false, 'connectors/load')
        // Fire-and-forget migration on first authenticated load
        void migrateLocalConnectionsToSupabase(workbookId)
      },

      createConnection(conn) {
        const newConn: ConnectorConnection = {
          ...conn,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set(
          (state) => ({ connections: [...state.connections, newConn] }),
          false,
          'connectors/create'
        )
        void apiSave(newConn)
        return newConn
      },

      updateConnection(id, updates) {
        set(
          (state) => {
            const next = state.connections.map((c) =>
              c.id === id ? { ...c, ...updates } : c
            )
            return { connections: next }
          },
          false,
          'connectors/update'
        )
        const updated = get().connections.find((c) => c.id === id)
        if (updated) void apiSave(updated)
      },

      deleteConnection(id) {
        const conn = get().connections.find((c) => c.id === id)
        set(
          (state) => ({ connections: state.connections.filter((c) => c.id !== id) }),
          false,
          'connectors/delete'
        )
        if (conn) void apiDelete(conn.workbookId, id)
      },

      async runSync(id: string) {
        const conn = get().connections.find((c) => c.id === id)
        if (!conn) {
          set(
            (state) => ({ syncErrors: { ...state.syncErrors, [id]: 'Connection not found.' } }),
            false,
            'connectors/syncError'
          )
          return
        }

        // Mark syncing
        set(
          (state) => ({
            syncing: { ...state.syncing, [id]: true },
            syncErrors: { ...state.syncErrors, [id]: '' },
          }),
          false,
          'connectors/syncStart'
        )

        try {
          const connector = getConnector(conn.connectorKind)
          const result = await connector.fetch(conn.config)

          // Build mapping: use saved mapping, or auto-map if none saved
          const mapping =
            conn.mapping.length > 0
              ? conn.mapping
              : buildDefaultMapping(result.columns)

          const cells = applyMapping(result, mapping, 0, true)

          // Find the target sheet and apply the cells
          const { gridSheets } = useSheetStore.getState()
          const { activeSheetId } = useWorkbookStore.getState()
          const targetId = conn.sheetId || activeSheetId

          const targetSheet = gridSheets.find(
            (s) => (typeof s.id === 'string' ? s.id : '') === targetId
          )

          if (targetSheet) {
            // Build the new 2-D matrix from existing data
            const matrix: CellMatrix = getSheetMatrix(targetSheet)

            // Apply mapped cells — convert MappedCell.v to FortuneSheet Cell
            for (const mappedCell of cells) {
              // Extend matrix rows if needed
              while (matrix.length <= mappedCell.r) {
                matrix.push([])
              }
              const rowArr = matrix[mappedCell.r]
              if (rowArr) {
                const { v, m, ct } = mappedCell.v
                // Cast through unknown to bridge MappedCell ct type → FortuneSheet Cell ct type
                const cell: Cell | null =
                  v === null
                    ? null
                    : ({ v: v as Cell['v'], m, ...(ct ? { ct } : {}) } as unknown as Cell)
                rowArr[mappedCell.c] = cell
              }
            }

            const updatedSheet: Sheet = cloneSheetWithData(targetSheet, matrix)
            const nextSheets = gridSheets.map((s) =>
              (typeof s.id === 'string' ? s.id : '') === targetId ? updatedSheet : s
            )
            useSheetStore.getState().replaceGridSheets(nextSheets)
          }

          // Update lastSyncedAt
          void apiUpdateLastSynced(conn.workbookId, id)
          set(
            (state) => ({
              syncing: { ...state.syncing, [id]: false },
              connections: state.connections.map((c) =>
                c.id === id ? { ...c, lastSyncedAt: new Date().toISOString() } : c
              ),
            }),
            false,
            'connectors/syncDone'
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Sync failed. Check the connection config.'
          set(
            (state) => ({
              syncing: { ...state.syncing, [id]: false },
              syncErrors: { ...state.syncErrors, [id]: message },
            }),
            false,
            'connectors/syncError'
          )
        }
      },

      openBuilder(connectionId?: string) {
        set(
          {
            builderOpen: true,
            activeConnectionId: connectionId ?? null,
          },
          false,
          'connectors/openBuilder'
        )
      },

      closeBuilder() {
        set(
          { builderOpen: false, activeConnectionId: null },
          false,
          'connectors/closeBuilder'
        )
      },

      setActive(id: string | null) {
        set({ activeConnectionId: id }, false, 'connectors/setActive')
      },
    }),
    { name: 'ConnectorsStore' }
  )
)
