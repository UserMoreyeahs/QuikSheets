'use client'

/**
 * versionsApi — canonical workbook version-history data path.
 *
 * Behaviour:
 *   1. If Supabase is configured AND the user has a session, read/write the
 *      `workbook_versions` table via the browser anon client (RLS enforces
 *      access using auth.uid()).
 *   2. Otherwise — Supabase not configured, user not signed in, or any
 *      network/RLS failure — fall back to the localStorage store so the UI
 *      keeps working in standalone/demo mode.
 *
 * One-time migration: on the first successful Supabase load with an
 * authenticated user, any local-only snapshots for the same workbook are
 * flushed up to Supabase.
 *
 * Snapshot shape persisted in both paths:
 *   { sheets: Sheet[] }
 * This is the same shape the existing LocalVersionHistoryPanel uses, so
 * local → Supabase migrations work without conversion.
 */

import type { Sheet } from '@fortune-sheet/core'
import { getBrowserSupabase } from '@/lib/supabase/client'
import {
  snapshotWorkbook as localSnapshot,
  listWorkbookVersions as listLocalVersions,
  deleteVersion as deleteLocalVersion,
  type StoredVersion,
} from '@/features/version-history/storage/localVersionStore'
import { cloneSheetWithData, getSheetMatrix } from '@/lib/fortuneSheet'

// ------------------------------------------------------------------
// Public types
// ------------------------------------------------------------------

export interface VersionRecord {
  id: string
  workbookId: string
  label: string
  createdAt: number          // Unix ms — matches StoredVersion for symmetry
  /** Source: 'remote' when the row came from Supabase, 'local' otherwise. */
  source: 'remote' | 'local'
}

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

const MIGRATED_FLAG_PREFIX = 'quiksheets_versions_migrated_to_supabase'

function migratedFlagKey(workbookId: string): string {
  return `${MIGRATED_FLAG_PREFIX}:${workbookId}`
}

function hasMigrated(workbookId: string): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(migratedFlagKey(workbookId)) === 'true'
}

function markMigrated(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(migratedFlagKey(workbookId), 'true')
}

interface SessionContext {
  userId: string
}

async function getSession(): Promise<SessionContext | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return null
    return { userId: user.id }
  } catch {
    return null
  }
}

interface DbVersionRow {
  id: string
  workbook_id: string
  label: string | null
  snapshot: unknown
  created_by: string | null
  created_at: string
}

function dbRowToRecord(row: DbVersionRow): VersionRecord {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    label: row.label ?? 'Snapshot',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    source: 'remote',
  }
}

function localToRecord(v: StoredVersion): VersionRecord {
  return {
    id: v.id,
    workbookId: v.workbookId,
    label: v.label,
    createdAt: v.createdAt,
    source: 'local',
  }
}

/** Snapshot payload stored in both Supabase and localStorage. */
interface SnapshotPayload {
  sheets: Sheet[]
}

// ------------------------------------------------------------------
// One-time migration: localStorage → Supabase
// ------------------------------------------------------------------

async function migrateLocalToSupabase(
  workbookId: string,
  session: SessionContext
): Promise<void> {
  if (hasMigrated(workbookId)) return
  const local = listLocalVersions(workbookId)
  if (local.length === 0) {
    markMigrated(workbookId)
    return
  }

  const supabase = getBrowserSupabase()
  if (!supabase) return

  // Insert oldest-first so created_at ordering survives.
  const rows = local
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((v) => ({
      workbook_id: workbookId,
      snapshot: { sheets: v.snapshot } satisfies SnapshotPayload,
      label: v.label,
      created_by: session.userId,
      created_at: new Date(v.createdAt).toISOString(),
    }))

  const { error } = await supabase.from('workbook_versions').insert(rows)
  if (error) {
    // Leave the flag unset so we can retry on next load.
    // eslint-disable-next-line no-console
    console.debug('[versionsApi] migration deferred:', error.message)
    return
  }
  markMigrated(workbookId)
  // Clear local snapshots once safely in Supabase.
  for (const v of local) {
    deleteLocalVersion(workbookId, v.id)
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * List versions for a workbook, newest first.
 *
 * Falls back to localStorage when Supabase is not configured, the user
 * is not signed in, or any request fails.
 */
export async function listVersions(workbookId: string): Promise<VersionRecord[]> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    return listLocalVersions(workbookId).map(localToRecord)
  }

  // Best-effort one-shot migration before the first read returns.
  await migrateLocalToSupabase(workbookId, session)

  const { data, error } = await supabase
    .from('workbook_versions')
    .select('id, workbook_id, label, created_by, created_at')
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) {
    return listLocalVersions(workbookId).map(localToRecord)
  }
  return (data as DbVersionRow[]).map(dbRowToRecord)
}

/**
 * Write a new snapshot for the workbook.
 *
 * Falls back to localStorage on any Supabase failure.
 * Returns the new VersionRecord so callers can refresh their list cheaply.
 */
export async function snapshotVersion(
  workbookId: string,
  sheets: Sheet[],
  label?: string
): Promise<VersionRecord> {
  const payload: SnapshotPayload = { sheets: JSON.parse(JSON.stringify(sheets)) as Sheet[] }
  const resolvedLabel = (label ?? '').trim() || `Snapshot ${new Date().toLocaleString()}`

  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    const stored = localSnapshot(workbookId, sheets, resolvedLabel)
    return localToRecord(stored)
  }

  const { data, error } = await supabase
    .from('workbook_versions')
    .insert({
      workbook_id: workbookId,
      snapshot: payload,
      label: resolvedLabel,
      created_by: session.userId,
    })
    .select('id, workbook_id, label, created_by, created_at')
    .single()

  if (error || !data) {
    // Network / RLS deny — mirror to localStorage.
    const stored = localSnapshot(workbookId, sheets, resolvedLabel)
    return localToRecord(stored)
  }
  return dbRowToRecord(data as DbVersionRow)
}

/**
 * Restore a snapshot by id.
 *
 * Flow:
 *  1. Create a pre-restore safety snapshot of the CURRENT sheets (so the
 *     restore is itself undoable).
 *  2. Fetch the target snapshot.
 *  3. Return the Sheet[] from the snapshot — the caller applies them via
 *     replaceGridSheets().
 *
 * Returns null if the snapshot cannot be found or the payload is invalid.
 */
export async function restoreVersion(
  workbookId: string,
  versionId: string,
  currentSheets: Sheet[]
): Promise<Sheet[] | null> {
  // Step 1 — safety snapshot (best-effort; never blocks the restore).
  try {
    await snapshotVersion(workbookId, currentSheets, 'Auto-saved before restore')
  } catch {
    // continue
  }

  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    // Local path — look up the version in localStorage.
    const local = listLocalVersions(workbookId).find((v) => v.id === versionId)
    if (!local) return null
    return cloneSheets(local.snapshot)
  }

  const { data, error } = await supabase
    .from('workbook_versions')
    .select('snapshot')
    .eq('id', versionId)
    .eq('workbook_id', workbookId)
    .maybeSingle()

  if (error || !data) return null

  const snap = (data as { snapshot: unknown }).snapshot
  return extractSheets(snap)
}

/**
 * Edit the label of an existing version. No-op on any failure.
 */
export async function editVersionLabel(
  workbookId: string,
  versionId: string,
  newLabel: string
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) return // local labels not editable for simplicity

  await supabase
    .from('workbook_versions')
    .update({ label: newLabel.trim() || null })
    .eq('id', versionId)
    .eq('workbook_id', workbookId)
}

/**
 * Delete a version. Owner-only in Supabase (RLS). No-op on failure.
 */
export async function deleteVersion(workbookId: string, versionId: string): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    deleteLocalVersion(workbookId, versionId)
    return
  }

  const { error } = await supabase
    .from('workbook_versions')
    .delete()
    .eq('id', versionId)
    .eq('workbook_id', workbookId)

  if (error) {
    // RLS deny (not owner) — fail silently; the panel will re-list.
  }
}

// ------------------------------------------------------------------
// Internal snapshot utilities
// ------------------------------------------------------------------

function extractSheets(raw: unknown): Sheet[] | null {
  if (!raw || typeof raw !== 'object') return null
  const snap = raw as { sheets?: unknown }
  if (!Array.isArray(snap.sheets) || snap.sheets.length === 0) return null
  return cloneSheets(snap.sheets as Sheet[])
}

function cloneSheets(sheets: Sheet[]): Sheet[] {
  return sheets.map((s) => {
    try {
      return cloneSheetWithData(s, getSheetMatrix(s))
    } catch {
      return JSON.parse(JSON.stringify(s)) as Sheet
    }
  })
}
