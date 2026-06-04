'use client'

/**
 * dashboardsApi — persistence layer for Advanced Dashboards (P2 #32).
 *
 * Behaviour:
 *   1. If Supabase is configured AND the user has a session, read/write to
 *      the `dashboards` table via the browser anon client
 *      (RLS enforces workbook membership via workbook_members).
 *   2. Otherwise — Supabase not configured, user not signed in, or any
 *      network/RLS failure — fall back to localStorage so the UI keeps
 *      working in standalone/demo mode.
 *
 * Migration: on the first authenticated load for a workbook, any existing
 * localStorage dashboards are uploaded to Supabase (one-time, gated by the
 * flag `quiksheets_dashboards_migrated:<wbId>`).
 *
 * Local storage key: `quiksheets_dashboards:<workbookId>`
 *   Shape: Dashboard[]
 *
 * Follows the same pattern as cfRulesApi.ts.
 */

import { getBrowserSupabase } from './supabase/client'
import { getClientSession } from './supabase/getClientSession'
import { createMigrationFlag } from './supabase/migrationFlag'
import { makeLocalStore } from './localJsonStore'
import { logger } from '@/lib/logger'
import type { Dashboard } from '@/features/dashboards/types'

// ---------------------------------------------------------------------------
// Local-storage helpers (fallback)
// ---------------------------------------------------------------------------

const localDashboards = makeLocalStore<Dashboard[]>('quiksheets_dashboards')
const migrationFlag = createMigrationFlag('quiksheets_dashboards_migrated')

function readLocal(workbookId: string): Dashboard[] {
  return localDashboards.read(workbookId) ?? []
}

function writeLocal(workbookId: string, dashboards: Dashboard[]): void {
  localDashboards.write(workbookId, dashboards)
}

function clearLocal(workbookId: string): void {
  localDashboards.clear(workbookId)
}

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface DbDashboardRow {
  id: string
  workbook_id: string
  name: string
  widgets_json: Dashboard['widgets']
  created_by: string | null
  created_at: string
  updated_at: string
}

function rowToDashboard(row: DbDashboardRow): Dashboard {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    name: row.name,
    widgets: Array.isArray(row.widgets_json) ? row.widgets_json : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// One-time migration: localStorage → Supabase
// ---------------------------------------------------------------------------

async function migrateLocalToSupabase(
  workbookId: string,
  userId: string
): Promise<void> {
  if (migrationFlag.has(workbookId)) return

  const existing = readLocal(workbookId)
  if (existing.length === 0) {
    migrationFlag.mark(workbookId)
    return
  }

  const supabase = getBrowserSupabase()
  if (!supabase) return

  const rows = existing.map((d) => ({
    id: d.id,
    workbook_id: workbookId,
    name: d.name,
    widgets_json: d.widgets as unknown as Record<string, unknown>[],
    created_by: userId,
  }))

  const { error } = await supabase.from('dashboards').insert(rows)
  if (error) {
    logger.debug('dashboardsApi', 'migration deferred:', error.message)
    return
  }

  migrationFlag.mark(workbookId)
  clearLocal(workbookId)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all dashboards for a workbook.
 * Supabase-first with localStorage fallback.
 */
export async function loadDashboards(workbookId: string): Promise<Dashboard[]> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  if (!supabase || !session) {
    return readLocal(workbookId)
  }

  await migrateLocalToSupabase(workbookId, session.userId)

  const { data, error } = await supabase
    .from('dashboards')
    .select('id, workbook_id, name, widgets_json, created_by, created_at, updated_at')
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: true })

  if (error || !data) {
    logger.warn('dashboardsApi', 'loadDashboards failed; serving local cache (possible schema/RLS drift)', error?.message)
    return readLocal(workbookId)
  }

  return (data as DbDashboardRow[]).map(rowToDashboard)
}

/**
 * Upsert a dashboard to Supabase (or localStorage fallback).
 * Also writes to localStorage as a cache.
 */
export async function saveDashboard(
  workbookId: string,
  dashboard: Dashboard
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  // Always update localStorage.
  const current = readLocal(workbookId)
  const next = [
    ...current.filter((d) => d.id !== dashboard.id),
    dashboard,
  ]
  writeLocal(workbookId, next)

  if (!supabase || !session) return

  const row = {
    id: dashboard.id,
    workbook_id: workbookId,
    name: dashboard.name,
    widgets_json: dashboard.widgets as unknown as Record<string, unknown>[],
    created_by: session.userId,
  }

  const { error } = await supabase
    .from('dashboards')
    .upsert(row, { onConflict: 'id' })

  if (error) {
    logger.debug('dashboardsApi', 'saveDashboard error:', error.message)
  }
}

/**
 * Delete a dashboard from Supabase (or localStorage fallback).
 */
export async function deleteDashboard(
  workbookId: string,
  dashboardId: string
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  // Update localStorage.
  const current = readLocal(workbookId)
  writeLocal(workbookId, current.filter((d) => d.id !== dashboardId))

  if (!supabase || !session) return

  const { error } = await supabase
    .from('dashboards')
    .delete()
    .eq('id', dashboardId)

  if (error) {
    logger.debug('dashboardsApi', 'deleteDashboard error:', error.message)
  }
}
