'use client'

/**
 * cfRulesApi — canonical persistence layer for Conditional Formatting rules.
 *
 * Behaviour:
 *   1. If Supabase is configured AND the user has a session, read/write to
 *      the `conditional_format_rules` table via the browser anon client
 *      (RLS enforces workbook membership).
 *   2. Otherwise — Supabase not configured, user not signed in, or any
 *      network/RLS failure — fall back to localStorage so the UI keeps
 *      working in standalone/demo mode.
 *
 * Migration: on the first authenticated load for a workbook, any existing
 * localStorage rules are uploaded to Supabase (one-time, gated by the
 * flag `quiksheets_cf_migrated_to_supabase:<wbId>`).
 *
 * Local storage key: `quiksheets_cf_rules:<workbookId>`
 *   Shape: Record<sheetId, CFRule[]>
 */

import { getBrowserSupabase } from './supabase/client'
import type { CFRule } from '@/features/conditional-formatting/types'

// ---------------------------------------------------------------------------
// Local-storage helpers (fallback)
// ---------------------------------------------------------------------------

const LOCAL_RULES_PREFIX = 'quiksheets_cf_rules:'
const MIGRATED_FLAG_PREFIX = 'quiksheets_cf_migrated_to_supabase:'

function localRulesKey(workbookId: string): string {
  return `${LOCAL_RULES_PREFIX}${workbookId}`
}

function migratedFlagKey(workbookId: string): string {
  return `${MIGRATED_FLAG_PREFIX}${workbookId}`
}

function hasMigrated(workbookId: string): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(migratedFlagKey(workbookId)) === 'true'
}

function markMigrated(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(migratedFlagKey(workbookId), 'true')
}

/** Read all CF rules from localStorage for the workbook. */
function readLocalRules(workbookId: string): Record<string, CFRule[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(localRulesKey(workbookId))
    return raw ? (JSON.parse(raw) as Record<string, CFRule[]>) : {}
  } catch {
    return {}
  }
}

/** Write all CF rules for the workbook to localStorage. */
function writeLocalRules(workbookId: string, rules: Record<string, CFRule[]>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(localRulesKey(workbookId), JSON.stringify(rules))
  } catch {
    // localStorage quota exceeded — ignore
  }
}

function clearLocalRules(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(localRulesKey(workbookId))
}

// ---------------------------------------------------------------------------
// Supabase session helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface DbCFRuleRow {
  id: string
  workbook_id: string
  sheet_id: string
  range_ref: string
  rule_json: CFRule
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// One-time migration: localStorage → Supabase
// ---------------------------------------------------------------------------

/**
 * Upload all localStorage CF rules for the workbook to Supabase.
 * Safe to call multiple times — the flag short-circuits after the first
 * successful run. If the insert fails, the flag is NOT set so we retry
 * on the next page load.
 */
async function migrateLocalToSupabase(
  workbookId: string,
  session: SessionContext
): Promise<void> {
  if (hasMigrated(workbookId)) return

  const localRules = readLocalRules(workbookId)
  const allRules: CFRule[] = Object.values(localRules).flat()

  if (allRules.length === 0) {
    markMigrated(workbookId)
    return
  }

  const supabase = getBrowserSupabase()
  if (!supabase) return

  // Build one row per rule so we can upsert them with individual IDs.
  const rows = allRules.map((rule) => {
    // Find which sheetId this rule belongs to.
    const sheetId =
      Object.entries(localRules).find(([, sheetRules]) =>
        sheetRules.some((r) => r.id === rule.id)
      )?.[0] ?? ''
    return {
      id: rule.id,
      workbook_id: workbookId,
      sheet_id: sheetId,
      range_ref: rule.range,
      rule_json: rule as unknown as Record<string, unknown>,
      created_by: session.userId,
    }
  })

  const { error } = await supabase.from('conditional_format_rules').insert(rows)
  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[cfRulesApi] migration deferred:', error.message)
    return
  }

  markMigrated(workbookId)
  clearLocalRules(workbookId)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all CF rules for a workbook from Supabase (or localStorage fallback).
 * Returns a map keyed by sheetId.
 *
 * Triggers the one-time localStorage → Supabase migration on the first
 * authenticated call.
 */
export async function loadRules(workbookId: string): Promise<Record<string, CFRule[]>> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    return readLocalRules(workbookId)
  }

  // Best-effort one-shot migration before the first read.
  await migrateLocalToSupabase(workbookId, session)

  const { data, error } = await supabase
    .from('conditional_format_rules')
    .select('id, workbook_id, sheet_id, range_ref, rule_json, created_by, created_at, updated_at')
    .eq('workbook_id', workbookId)

  if (error || !data) {
    // RLS deny / network blip — fall back to localStorage.
    return readLocalRules(workbookId)
  }

  // Group rows by sheet_id.
  const result: Record<string, CFRule[]> = {}
  for (const row of data as DbCFRuleRow[]) {
    const sheetId = row.sheet_id
    const existing = result[sheetId] ?? []
    // rule_json is the full CFRule object; spread to ensure id is set.
    const rule: CFRule = { ...row.rule_json, id: row.rule_json.id ?? row.id }
    result[sheetId] = [...existing, rule]
  }
  return result
}

/**
 * Persist a new CF rule to Supabase (or localStorage fallback).
 * Also writes to localStorage as a cache so offline reloads still work.
 */
export async function saveRule(workbookId: string, sheetId: string, rule: CFRule): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  // Always update localStorage so offline/fallback reloads work.
  const localRules = readLocalRules(workbookId)
  const sheetRules = localRules[sheetId] ?? []
  const nextLocal = {
    ...localRules,
    [sheetId]: [...sheetRules.filter((r) => r.id !== rule.id), rule],
  }
  writeLocalRules(workbookId, nextLocal)

  if (!supabase || !session) return

  const row = {
    id: rule.id,
    workbook_id: workbookId,
    sheet_id: sheetId,
    range_ref: rule.range,
    rule_json: rule as unknown as Record<string, unknown>,
    created_by: session.userId,
  }

  const { error } = await supabase
    .from('conditional_format_rules')
    .upsert(row, { onConflict: 'id' })

  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[cfRulesApi] saveRule error:', error.message)
    // localStorage already updated above — data is not lost.
  }
}

/**
 * Update an existing CF rule in Supabase (or localStorage fallback).
 */
export async function updateRule(
  workbookId: string,
  sheetId: string,
  rule: CFRule
): Promise<void> {
  // updateRule and saveRule have the same upsert behaviour.
  return saveRule(workbookId, sheetId, rule)
}

/**
 * Delete a CF rule from Supabase (or localStorage fallback).
 */
export async function deleteRule(
  workbookId: string,
  sheetId: string,
  ruleId: string
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  // Update localStorage.
  const localRules = readLocalRules(workbookId)
  const sheetRules = localRules[sheetId] ?? []
  const nextLocal = {
    ...localRules,
    [sheetId]: sheetRules.filter((r) => r.id !== ruleId),
  }
  writeLocalRules(workbookId, nextLocal)

  if (!supabase || !session) return

  const { error } = await supabase
    .from('conditional_format_rules')
    .delete()
    .eq('id', ruleId)

  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[cfRulesApi] deleteRule error:', error.message)
    // localStorage already updated above — data is not lost.
  }
}

/**
 * Delete ALL CF rules for a sheet from Supabase (or localStorage fallback).
 * Used by `clearFromSheet`.
 */
export async function deleteAllRulesForSheet(
  workbookId: string,
  sheetId: string
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  // Update localStorage.
  const localRules = readLocalRules(workbookId)
  const nextLocal = { ...localRules, [sheetId]: [] }
  writeLocalRules(workbookId, nextLocal)

  if (!supabase || !session) return

  const { error } = await supabase
    .from('conditional_format_rules')
    .delete()
    .eq('workbook_id', workbookId)
    .eq('sheet_id', sheetId)

  if (error) {
    // eslint-disable-next-line no-console
    console.debug('[cfRulesApi] deleteAllRulesForSheet error:', error.message)
  }
}
