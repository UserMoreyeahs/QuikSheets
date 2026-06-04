#!/usr/bin/env node
/**
 * check-schema-drift.mjs — fail-fast guard against schema drift.
 *
 * The bug class this catches: client code SELECTs/INSERTs a column the LIVE
 * table doesn't have → PostgREST returns 42703 → the app's try/catch silently
 * falls back to localStorage, so a feature "works" on one device but never
 * syncs (this silently broke forms, dashboards, and — until migration 0013 —
 * cloud cell-data persistence via `workbooks.data`).
 *
 * It reads the LIVE table/column inventory from the PostgREST OpenAPI spec
 * (`GET /rest/v1/`) — works over HTTPS even when the Postgres pooler is down —
 * and asserts every column the app HARD-DEPENDS on actually exists. Exit code
 * 1 (with a report) if anything is missing, 0 if the live schema satisfies the
 * app's contract.
 *
 * Wire into CI after build:  npm run db:check-drift
 *   Requires NEXT_PUBLIC_SUPABASE_URL + a Supabase key in env or .env.local.
 *
 * REQUIRED is the app's critical column contract, derived from the
 * Supabase-backed modules (src/lib/*Api.ts) + sheetApi. When a feature starts
 * depending on a new column, add it here so CI guards it.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function readEnv(names) {
  for (const n of names) if (process.env[n]) return process.env[n]
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const n of names) {
      const m = raw.match(new RegExp(`^${n}=(.*)$`, 'm'))
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* rely on process.env */
  }
  return undefined
}

// The app's hard column dependencies (the ones whose absence silently breaks a
// feature). Keep in sync with src/lib/*Api.ts + src/lib/sheetApi.ts.
const REQUIRED = {
  workbooks: ['id', 'name', 'data', 'owner_id', 'updated_at'],
  forms: ['id', 'workbook_id', 'sheet_id', 'name', 'slug', 'description', 'fields', 'accepts_submissions', 'created_at', 'updated_at'],
  form_submissions: ['id', 'form_id', 'values', 'submitter_email', 'submitted_at'],
  dashboards: ['id', 'workbook_id', 'name', 'widgets_json', 'created_by', 'created_at', 'updated_at'],
  comments: ['id', 'workbook_id', 'sheet_id', 'cell_address', 'body', 'author_id', 'author_display_name', 'mentions', 'parent_id', 'resolved', 'created_at', 'updated_at'],
  column_types: ['id', 'workbook_id', 'sheet_id', 'column_index', 'type', 'config', 'created_at', 'updated_at'],
  conditional_format_rules: ['id', 'workbook_id', 'sheet_id', 'range_ref', 'rule_json', 'created_by', 'created_at', 'updated_at'],
  share_links: ['id', 'token', 'workbook_id', 'role', 'expires_at', 'active', 'created_at'],
  workbook_versions: ['id', 'workbook_id', 'label', 'snapshot', 'created_by', 'created_at'],
  workbook_extras: ['workbook_id', 'extras_json', 'updated_at'],
  protected_ranges: ['id', 'workbook_id', 'sheet_id', 'range_ref', 'allowed_user_ids', 'allowed_roles', 'description'],
  notifications: ['id', 'user_id', 'workbook_id', 'actor_id', 'type', 'read', 'created_at'],
  workbook_members: ['workbook_id', 'user_id', 'role'],
  workspace_members: ['workspace_id', 'user_id'],
}

// Use process.exitCode (not process.exit) + natural return so Node tears down
// the fetch/undici handles cleanly — process.exit() races them on Windows and
// trips a libuv assertion, masking the real exit code.
async function main() {
  const URL_ = readEnv(['NEXT_PUBLIC_SUPABASE_URL'])
  const KEY = readEnv(['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  if (!URL_ || !KEY) {
    console.error('✗ schema-drift: missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key (env/.env.local)')
    return 2
  }

  const res = await fetch(`${URL_}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!res.ok) {
    console.error(`✗ schema-drift: OpenAPI fetch failed (HTTP ${res.status})`)
    return 2
  }
  const defs = (await res.json()).definitions || {}

  const problems = []
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const def = defs[table]
    if (!def) {
      problems.push(`MISSING TABLE  ${table}`)
      continue
    }
    const live = new Set(Object.keys(def.properties || {}))
    for (const c of cols) {
      if (!live.has(c)) problems.push(`MISSING COLUMN ${table}.${c}`)
    }
  }

  if (problems.length === 0) {
    const cols = Object.values(REQUIRED).reduce((n, c) => n + c.length, 0)
    console.log(`✓ schema-drift: live schema satisfies the app contract (${Object.keys(REQUIRED).length} tables, ${cols} required columns).`)
    return 0
  }

  console.error('✗ schema-drift: the live database is MISSING columns the app depends on.')
  console.error('  Each of these causes a silent 42703 → localStorage fallback in production:\n')
  for (const p of problems) console.error(`    ${p}`)
  console.error('\n  Fix by applying the relevant migration in src/supabase/migrations/.')
  return 1
}

process.exitCode = await main()
