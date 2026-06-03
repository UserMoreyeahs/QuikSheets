'use client'

/**
 * rowRlsApi — canonical persistence layer for Row Visibility (RLS) rules.
 *
 * Behaviour (mirrors cfRulesApi.ts EXACTLY):
 *   1. If Supabase is configured AND the user has a session, read/write the
 *      `row_visibility_rules` table via the browser anon client (RLS enforces
 *      workbook membership).
 *   2. Otherwise fall back to localStorage so the UI keeps working in
 *      standalone / demo mode.
 *
 * Migration: on the first authenticated load for a workbook, any existing
 * localStorage rules are uploaded to Supabase (one-time, gated by the flag
 * `quiksheets_row_rls_migrated_to_supabase:<wbId>`).
 *
 * Local storage key: `quiksheets_row_rls:<workbookId>`
 *   Shape: Record<sheetId, RowVisibilityRule[]>
 */

import { getBrowserSupabase } from './supabase/client'
import { getClientSession } from './supabase/getClientSession'
import { createMigrationFlag } from './supabase/migrationFlag'
import { makeLocalStore } from './localJsonStore'
import { logger } from '@/lib/logger'
import type { RowVisibilityRule } from '@/features/row-rls/types'

// ---------------------------------------------------------------------------
// Local-storage helpers (fallback)
// ---------------------------------------------------------------------------

const localRules = makeLocalStore<Record<string, RowVisibilityRule[]>>('quiksheets_row_rls')
const migrationFlag = createMigrationFlag('quiksheets_row_rls_migrated_to_supabase')

function readLocal(workbookId: string): Record<string, RowVisibilityRule[]> {
  return localRules.read(workbookId) ?? {}
}
function writeLocal(workbookId: string, rules: Record<string, RowVisibilityRule[]>): void {
  localRules.write(workbookId, rules)
}
function clearLocal(workbookId: string): void {
  localRules.clear(workbookId)
}

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface DbRowVisibilityRuleRow {
  id: string
  workbook_id: string
  sheet_id: string
  name: string
  predicate_json: RowVisibilityRule['predicate']
  scope_json: RowVisibilityRule['scope']
  enabled: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// One-time migration: localStorage → Supabase
// ---------------------------------------------------------------------------

async function migrateLocalToSupabase(
  workbookId: string,
  userId: string
): Promise<void> {
  if (migrationFlag.has(workbookId)) return

  const stored = readLocal(workbookId)
  const allRules: RowVisibilityRule[] = Object.values(stored).flat()

  if (allRules.length === 0) {
    migrationFlag.mark(workbookId)
    return
  }

  const supabase = getBrowserSupabase()
  if (!supabase) return

  const rows: Omit<DbRowVisibilityRuleRow, 'created_at' | 'updated_at'>[] = allRules.map(
    (rule) => ({
      id: rule.id,
      workbook_id: workbookId,
      sheet_id: rule.sheetId,
      name: rule.name,
      predicate_json: rule.predicate,
      scope_json: rule.scope,
      enabled: rule.enabled,
      created_by: userId,
    })
  )

  const { error } = await supabase.from('row_visibility_rules').insert(rows)
  if (error) {
    logger.debug('rowRlsApi', 'migration deferred:', error.message)
    return
  }

  migrationFlag.mark(workbookId)
  clearLocal(workbookId)
}

// ---------------------------------------------------------------------------
// Helpers: DB row → domain type
// ---------------------------------------------------------------------------

function rowToRule(row: DbRowVisibilityRuleRow): RowVisibilityRule {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    name: row.name,
    predicate: row.predicate_json,
    scope: row.scope_json,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all Row RLS rules for a workbook from Supabase (or localStorage).
 * Returns a map keyed by sheetId.
 *
 * Triggers the one-time localStorage → Supabase migration on the first
 * authenticated call.
 */
export async function loadRules(
  workbookId: string
): Promise<Record<string, RowVisibilityRule[]>> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  if (!supabase || !session) {
    return readLocal(workbookId)
  }

  await migrateLocalToSupabase(workbookId, session.userId)

  const { data, error } = await supabase
    .from('row_visibility_rules')
    .select(
      'id, workbook_id, sheet_id, name, predicate_json, scope_json, enabled, created_by, created_at, updated_at'
    )
    .eq('workbook_id', workbookId)

  if (error || !data) {
    return readLocal(workbookId)
  }

  const result: Record<string, RowVisibilityRule[]> = {}
  for (const row of data as DbRowVisibilityRuleRow[]) {
    const sheetId = row.sheet_id
    const existing = result[sheetId] ?? []
    result[sheetId] = [...existing, rowToRule(row)]
  }
  return result
}

/**
 * Persist a new (or updated) rule to Supabase (or localStorage).
 * Also writes to localStorage as a read-through cache.
 */
export async function saveRule(
  workbookId: string,
  sheetId: string,
  rule: RowVisibilityRule
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  // Always update localStorage first.
  const stored = readLocal(workbookId)
  const existing = stored[sheetId] ?? []
  writeLocal(workbookId, {
    ...stored,
    [sheetId]: [...existing.filter((r) => r.id !== rule.id), rule],
  })

  if (!supabase || !session) return

  const row = {
    id: rule.id,
    workbook_id: workbookId,
    sheet_id: sheetId,
    name: rule.name,
    predicate_json: rule.predicate as unknown as Record<string, unknown>,
    scope_json: rule.scope as unknown as Record<string, unknown>,
    enabled: rule.enabled,
    created_by: session.userId,
  }

  const { error } = await supabase
    .from('row_visibility_rules')
    .upsert(row, { onConflict: 'id' })

  if (error) {
    logger.debug('rowRlsApi', 'saveRule error:', error.message)
  }
}

/**
 * Update an existing rule. Delegates to saveRule (upsert semantics).
 */
export async function updateRule(
  workbookId: string,
  sheetId: string,
  rule: RowVisibilityRule
): Promise<void> {
  return saveRule(workbookId, sheetId, rule)
}

/**
 * Delete a rule by ID from Supabase (and localStorage).
 */
export async function deleteRule(
  workbookId: string,
  sheetId: string,
  ruleId: string
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  const stored = readLocal(workbookId)
  const existing = stored[sheetId] ?? []
  writeLocal(workbookId, {
    ...stored,
    [sheetId]: existing.filter((r) => r.id !== ruleId),
  })

  if (!supabase || !session) return

  const { error } = await supabase
    .from('row_visibility_rules')
    .delete()
    .eq('id', ruleId)

  if (error) {
    logger.debug('rowRlsApi', 'deleteRule error:', error.message)
  }
}

/**
 * Delete ALL rules for a sheet from Supabase (and localStorage).
 */
export async function deleteAllRulesForSheet(
  workbookId: string,
  sheetId: string
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getClientSession() : null

  const stored = readLocal(workbookId)
  writeLocal(workbookId, { ...stored, [sheetId]: [] })

  if (!supabase || !session) return

  const { error } = await supabase
    .from('row_visibility_rules')
    .delete()
    .eq('workbook_id', workbookId)
    .eq('sheet_id', sheetId)

  if (error) {
    logger.debug('rowRlsApi', 'deleteAllRulesForSheet error:', error.message)
  }
}
