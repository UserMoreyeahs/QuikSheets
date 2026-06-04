/**
 * Connector Connections Persistence API
 *
 * Supabase-first with localStorage fallback, following the cfRulesApi pattern.
 *
 * Supabase schema:
 *   public.connector_connections (see docs/setup/migrations/connectors_table.sql)
 *
 * Security:
 *   Config fields marked `kind === 'secret'` in the connector's configSchema
 *   are stored only in the Supabase `config_json` column (server-side encrypted
 *   via RLS + service-role client).  The localStorage fallback STRIPS secret
 *   fields to avoid persisting credentials in plaintext on the user's device.
 *
 * Supabase is unavailable:
 *   Falls back to localStorage silently.  Secret fields are never stored.
 *
 * One-time migration:
 *   A migration flag `quiksheets_connectors_migrated` in localStorage tracks
 *   whether the local connections have been pushed to Supabase. On the first
 *   authenticated load, any local connections are upserted to Supabase and
 *   the flag is set.
 */

import { getBrowserSupabase } from './supabase/client'
import { logger } from './logger'
import type { ConnectorConnection, ConnectorKind } from '@/features/connectors/types'
import { connectorRegistry } from '@/features/connectors/connectors/index'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEY_PREFIX = 'quiksheets_connectors:'
const MIGRATION_FLAG = 'quiksheets_connectors_migrated'

// ---------------------------------------------------------------------------
// Secret-field scrubbing
// ---------------------------------------------------------------------------

/** Return the set of secret field names for a given connector kind. */
function getSecretFields(kind: ConnectorKind): Set<string> {
  const connector = connectorRegistry[kind]
  const secrets = new Set<string>()
  if (!connector) return secrets
  for (const field of connector.configSchema) {
    if (field.kind === 'secret') secrets.add(field.name)
  }
  return secrets
}

/**
 * Remove secret fields from a config object before writing to localStorage.
 * Returns a safe copy with secret values replaced by the empty string (so
 * the key is still present for form pre-population, but the value is gone).
 */
function scrubSecrets(kind: ConnectorKind, config: Record<string, unknown>): Record<string, unknown> {
  const secrets = getSecretFields(kind)
  if (secrets.size === 0) return config
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    safe[k] = secrets.has(k) ? '' : v
  }
  return safe
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function lsKey(workbookId: string): string {
  return `${LS_KEY_PREFIX}${workbookId}`
}

function readFromLocalStorage(workbookId: string): ConnectorConnection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(lsKey(workbookId))
    return raw ? (JSON.parse(raw) as ConnectorConnection[]) : []
  } catch {
    return []
  }
}

function writeToLocalStorage(workbookId: string, connections: ConnectorConnection[]): void {
  if (typeof window === 'undefined') return
  try {
    // Scrub secrets from every connection before persisting
    const safe = connections.map((c) => ({
      ...c,
      config: scrubSecrets(c.connectorKind, c.config),
    }))
    localStorage.setItem(lsKey(workbookId), JSON.stringify(safe))
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

// ---------------------------------------------------------------------------
// Supabase row type (mirrors the SQL schema)
// ---------------------------------------------------------------------------

interface DbRow {
  id: string
  workbook_id: string
  sheet_id: string
  connector_kind: string
  config_json: Record<string, unknown>
  mapping_json: ConnectorConnection['mapping']
  schedule: ConnectorConnection['schedule']
  last_synced_at: string | null
  created_at: string
}

function rowToConnection(row: DbRow): ConnectorConnection {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    connectorKind: row.connector_kind as ConnectorKind,
    config: row.config_json,
    mapping: row.mapping_json,
    // exactOptionalPropertyTypes: only include optional fields when they have a value.
    ...(row.schedule ? { schedule: row.schedule } : {}),
    ...(row.last_synced_at ? { lastSyncedAt: row.last_synced_at } : {}),
    createdAt: row.created_at,
  }
}

function connectionToRow(
  conn: ConnectorConnection,
  userId: string
): Omit<DbRow, 'created_at'> & { created_by: string } {
  return {
    id: conn.id,
    workbook_id: conn.workbookId,
    sheet_id: conn.sheetId,
    connector_kind: conn.connectorKind,
    config_json: conn.config,
    mapping_json: conn.mapping,
    schedule: conn.schedule,
    last_synced_at: conn.lastSyncedAt ?? null,
    created_by: userId,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all connector connections for a workbook.
 *
 * Tries Supabase first; falls back to localStorage if Supabase is unavailable
 * or the user is unauthenticated.
 */
export async function loadConnections(workbookId: string): Promise<ConnectorConnection[]> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    const { data: session } = await supabase.auth.getSession()
    if (session.session) {
      const { data, error } = await supabase
        .from('connector_connections')
        .select('*')
        .eq('workbook_id', workbookId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        const connections = (data as DbRow[]).map(rowToConnection)
        // Mirror to localStorage (without secrets) for offline use
        writeToLocalStorage(workbookId, connections)
        return connections
      }
      if (error) logger.warn('connectorsApi', 'loadConnections failed; serving local cache (possible schema/RLS drift)', error.message)
    }
  }

  // localStorage fallback
  return readFromLocalStorage(workbookId)
}

/**
 * Save a connection (upsert).
 *
 * Persists to Supabase when authenticated; always writes to localStorage
 * (with secrets scrubbed).
 */
export async function saveConnection(conn: ConnectorConnection): Promise<void> {
  // Always update localStorage (secrets scrubbed)
  const existing = readFromLocalStorage(conn.workbookId)
  const idx = existing.findIndex((c) => c.id === conn.id)
  const next = idx >= 0
    ? existing.map((c) => (c.id === conn.id ? conn : c))
    : [...existing, conn]
  writeToLocalStorage(conn.workbookId, next)

  // Attempt Supabase upsert (with full config including secrets)
  const supabase = getBrowserSupabase()
  if (!supabase) return

  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return

  const userId = session.session.user.id
  const row = connectionToRow(conn, userId)

  const { error } = await supabase.from('connector_connections').upsert(row, { onConflict: 'id' })
  // localStorage already has the data; surface remote failure so it isn't invisible.
  if (error) logger.warn('connectorsApi', 'saveConnection upsert failed; kept local copy', error.message)
}

/**
 * Delete a connection by ID.
 */
export async function deleteConnection(workbookId: string, id: string): Promise<void> {
  // Update localStorage
  const existing = readFromLocalStorage(workbookId)
  writeToLocalStorage(workbookId, existing.filter((c) => c.id !== id))

  // Attempt Supabase delete
  const supabase = getBrowserSupabase()
  if (!supabase) return

  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return

  const { error } = await supabase.from('connector_connections').delete().eq('id', id)
  if (error) logger.warn('connectorsApi', 'deleteConnection failed; removed locally only', error.message)
}

/**
 * Update the `last_synced_at` timestamp for a connection.
 */
export async function updateLastSynced(workbookId: string, id: string): Promise<void> {
  const iso = new Date().toISOString()
  const existing = readFromLocalStorage(workbookId)
  const next = existing.map((c) =>
    c.id === id ? { ...c, lastSyncedAt: iso } : c
  )
  writeToLocalStorage(workbookId, next)

  const supabase = getBrowserSupabase()
  if (!supabase) return

  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return

  const { error } = await supabase
    .from('connector_connections')
    .update({ last_synced_at: iso })
    .eq('id', id)
  if (error) logger.warn('connectorsApi', 'updateLastSynced failed; updated locally only', error.message)
}

/**
 * One-time migration: push any existing localStorage connections to Supabase.
 * Safe to call on every authenticated page load — the flag prevents re-runs.
 */
export async function migrateLocalConnectionsToSupabase(workbookId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const flag = `${MIGRATION_FLAG}:${workbookId}`
  if (localStorage.getItem(flag)) return

  const supabase = getBrowserSupabase()
  if (!supabase) return

  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return

  const local = readFromLocalStorage(workbookId)
  if (local.length === 0) {
    localStorage.setItem(flag, '1')
    return
  }

  const userId = session.session.user.id
  const rows = local.map((c) => connectionToRow(c, userId))

  await supabase.from('connector_connections').upsert(rows, { onConflict: 'id' })
  localStorage.setItem(flag, '1')
}
