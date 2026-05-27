'use client'

/**
 * columnTypesApi — canonical persistence layer for per-column type metadata.
 *
 * Behaviour:
 *   1. If Supabase is configured AND the user has a session, read/write via
 *      the browser anon client (RLS does the access check using auth.uid()).
 *   2. Otherwise — Supabase not configured, user not signed in, or any
 *      network/RLS failure — fall back to localStorage so the UI keeps
 *      working in standalone/demo mode.
 *
 * Migration: on the first signed-in load of a workbook, any types that
 * exist only in localStorage for that workbook are uploaded to Supabase
 * (one-time, gated by a per-workbook localStorage flag).
 *
 * The shape stored in localStorage:
 *   key:  `quiksheets_column_types:<workbookId>`
 *   value: `{ [sheetId]: { [colIndex]: ColumnTypeMeta } }`
 */

import { getBrowserSupabase } from './supabase/client'
import type { ColumnTypeMeta } from '@/features/typed-columns/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Flat per-sheet map: colIndex (as string) → ColumnTypeMeta. */
type SheetColumnMap = Record<string, ColumnTypeMeta>

/** Full workbook map: sheetId → SheetColumnMap. */
export type WorkbookColumnMap = Record<string, SheetColumnMap>

/** A row read back from the Supabase `column_types` table. */
interface DbColumnTypeRow {
  id: string
  workbook_id: string
  sheet_id: string
  column_index: number
  type: string
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'quiksheets_column_types:'
const MIGRATED_FLAG_PREFIX = 'quiksheets_col_types_migrated_to_supabase'

function localKey(workbookId: string): string {
  return `${STORAGE_PREFIX}${workbookId}`
}

function migratedFlagKey(workbookId: string): string {
  return `${MIGRATED_FLAG_PREFIX}:${workbookId}`
}

function hasMigratedWorkbook(workbookId: string): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(migratedFlagKey(workbookId)) === 'true'
}

function markWorkbookMigrated(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(migratedFlagKey(workbookId), 'true')
}

function readLocalMap(workbookId: string): WorkbookColumnMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(localKey(workbookId))
    return raw ? (JSON.parse(raw) as WorkbookColumnMap) : {}
  } catch {
    return {}
  }
}

function writeLocalMap(workbookId: string, data: WorkbookColumnMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(localKey(workbookId), JSON.stringify(data))
  } catch {
    /* quota exceeded — silently ignore */
  }
}

function clearLocalMap(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(localKey(workbookId))
}

// ─────────────────────────────────────────────────────────────────────────────
// DB shape helpers
// ─────────────────────────────────────────────────────────────────────────────

function dbRowToMeta(row: DbColumnTypeRow): ColumnTypeMeta {
  return {
    type: row.type as ColumnTypeMeta['type'],
    ...(row.config as Partial<ColumnTypeMeta>),
  }
}

function metaToConfig(meta: ColumnTypeMeta): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, ...rest } = meta
  return rest as Record<string, unknown>
}

function dbRowsToWorkbookMap(rows: DbColumnTypeRow[]): WorkbookColumnMap {
  const out: WorkbookColumnMap = {}
  for (const row of rows) {
    if (!out[row.sheet_id]) out[row.sheet_id] = {}
    const sheetMap = out[row.sheet_id]
    if (sheetMap) sheetMap[String(row.column_index)] = dbRowToMeta(row)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Session helper
// ─────────────────────────────────────────────────────────────────────────────

interface SessionContext {
  userId: string
}

async function getSession(): Promise<SessionContext | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    return { userId: data.user.id }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// One-time migration: localStorage → Supabase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On the first signed-in load, upload any locally-stored column types for
 * this workbook to Supabase, then set the migration flag and clear local data.
 *
 * Safe to call multiple times — the flag short-circuits after a successful run.
 * If Supabase throws midway the flag is NOT set, preserving local data.
 */
async function migrateLocalToSupabase(
  workbookId: string,
  _session: SessionContext,
): Promise<void> {
  if (hasMigratedWorkbook(workbookId)) return
  const local = readLocalMap(workbookId)
  const entries: { sheetId: string; colIndex: number; meta: ColumnTypeMeta }[] = []
  for (const [sheetId, colMap] of Object.entries(local)) {
    for (const [colIndexStr, meta] of Object.entries(colMap)) {
      const colIndex = Number(colIndexStr)
      if (!Number.isNaN(colIndex)) {
        entries.push({ sheetId, colIndex, meta })
      }
    }
  }

  if (entries.length === 0) {
    markWorkbookMigrated(workbookId)
    return
  }

  const supabase = getBrowserSupabase()
  if (!supabase) return

  const rows = entries.map(({ sheetId, colIndex, meta }) => ({
    workbook_id: workbookId,
    sheet_id: sheetId,
    column_index: colIndex,
    type: meta.type,
    config: metaToConfig(meta),
  }))

  // upsert so re-running doesn't fail on the unique constraint
  const { error } = await supabase
    .from('column_types')
    .upsert(rows, { onConflict: 'workbook_id,sheet_id,column_index' })

  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[columnTypesApi] migration deferred:', error.message)
    return
  }
  markWorkbookMigrated(workbookId)
  clearLocalMap(workbookId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all column-type metadata for a workbook.
 *
 * Returns a WorkbookColumnMap (keyed by sheetId → colIndex string → meta).
 * Falls back to localStorage when Supabase is not reachable.
 */
export async function loadColumnTypes(workbookId: string): Promise<WorkbookColumnMap> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    return readLocalMap(workbookId)
  }

  // Best-effort one-shot migration before returning.
  await migrateLocalToSupabase(workbookId, session)

  const { data, error } = await supabase
    .from('column_types')
    .select('id, workbook_id, sheet_id, column_index, type, config, created_at, updated_at')
    .eq('workbook_id', workbookId)

  if (error || !data) {
    // Network / RLS deny — fall back to local cache.
    return readLocalMap(workbookId)
  }

  return dbRowsToWorkbookMap(data as DbColumnTypeRow[])
}

/**
 * Persist a column type. Upserts by (workbook_id, sheet_id, column_index).
 *
 * Also writes to localStorage so offline reads stay consistent.
 */
export async function setColumnType(
  workbookId: string,
  sheetId: string,
  colIndex: number,
  meta: ColumnTypeMeta,
): Promise<void> {
  // Always write to localStorage first so the store is immediately
  // consistent even before the async Supabase call resolves.
  const local = readLocalMap(workbookId)
  if (!local[sheetId]) local[sheetId] = {}
  const sheetMap = local[sheetId]
  if (sheetMap) sheetMap[String(colIndex)] = meta
  writeLocalMap(workbookId, local)

  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null
  if (!supabase || !session) return

  const { error } = await supabase.from('column_types').upsert(
    {
      workbook_id: workbookId,
      sheet_id: sheetId,
      column_index: colIndex,
      type: meta.type,
      config: metaToConfig(meta),
    },
    { onConflict: 'workbook_id,sheet_id,column_index' },
  )

  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[columnTypesApi] setColumnType error:', error.message)
  }
}

/**
 * Remove a column type. Deletes from Supabase and from localStorage.
 */
export async function clearColumnType(
  workbookId: string,
  sheetId: string,
  colIndex: number,
): Promise<void> {
  // Remove from local immediately.
  const local = readLocalMap(workbookId)
  if (local[sheetId]) {
    delete local[sheetId]![String(colIndex)]
    writeLocalMap(workbookId, local)
  }

  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null
  if (!supabase || !session) return

  const { error } = await supabase
    .from('column_types')
    .delete()
    .eq('workbook_id', workbookId)
    .eq('sheet_id', sheetId)
    .eq('column_index', colIndex)

  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[columnTypesApi] clearColumnType error:', error.message)
  }
}
