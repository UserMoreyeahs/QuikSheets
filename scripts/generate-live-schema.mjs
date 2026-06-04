#!/usr/bin/env node
/**
 * generate-live-schema.mjs — regenerate the canonical table/column schema
 * from the LIVE Supabase database (the actual source of truth).
 *
 * WHY: the repo previously carried four divergent, hand-written schema
 * artifacts and NONE matched production (forms used `fields_json` in SQL but
 * `fields` in the live DB + code; dashboards lacked `updated_at`; 8 tables the
 * code needs weren't in any committed file). A fresh `apply-migration` from the
 * repo produced a database that couldn't save a cell. This script makes the
 * committed schema reproducible from live, so it can never silently drift again.
 *
 * HOW: PostgREST exposes the live table/column inventory via its OpenAPI spec
 * at `GET /rest/v1/` (RLS restricts ROWS, not schema introspection), so this
 * works over plain HTTPS even when the Postgres pooler / MCP DB connection is
 * unreachable. It writes column names + types only — RLS policies, triggers,
 * functions, and indexes live in the numbered migrations (0001–0012), which
 * remain the authoritative source for those objects.
 *
 * USAGE:  node scripts/generate-live-schema.mjs
 *   Requires NEXT_PUBLIC_SUPABASE_URL + a Supabase key in the environment or
 *   in .env.local (SUPABASE_SERVICE_ROLE_KEY preferred, else
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY).
 *
 * Output: src/supabase/schema.live.generated.sql
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Read an env var from process.env, falling back to a .env.local lookup. */
function readEnv(names) {
  for (const n of names) if (process.env[n]) return process.env[n]
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const n of names) {
      const m = raw.match(new RegExp(`^${n}=(.*)$`, 'm'))
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
  return undefined
}

const URL_ = readEnv(['NEXT_PUBLIC_SUPABASE_URL'])
const KEY = readEnv([
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
])

if (!URL_ || !KEY) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in env/.env.local')
  process.exit(2)
}

/** Map an OpenAPI property (PostgREST) to a Postgres column type. */
function sqlType(prop) {
  const fmt = String(prop.format || prop.type || 'text')
  // PostgREST reports arrays as e.g. "text[]" / "uuid[]" in `format` already.
  if (fmt.endsWith('[]')) return fmt
  const map = {
    uuid: 'uuid',
    text: 'text',
    'character varying': 'text',
    boolean: 'boolean',
    jsonb: 'jsonb',
    json: 'json',
    integer: 'integer',
    bigint: 'bigint',
    smallint: 'smallint',
    numeric: 'numeric',
    'double precision': 'double precision',
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    date: 'date',
  }
  return map[fmt] || fmt
}

const res = await fetch(`${URL_}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})
if (!res.ok) {
  console.error(`✗ OpenAPI fetch failed: HTTP ${res.status}`)
  process.exit(1)
}
const spec = await res.json()
const defs = spec.definitions || {}
const tables = Object.keys(defs).sort()

const stamp = process.env.SCHEMA_STAMP || 'a recent run (set SCHEMA_STAMP to record a date)'
let out = `-- schema.live.generated.sql — CANONICAL table/column reference.
--
-- GENERATED FROM THE LIVE DATABASE by scripts/generate-live-schema.mjs.
-- Do NOT hand-edit. Regenerate with:  npm run db:schema:generate
--
-- This file is the single source of truth for WHICH TABLES AND COLUMNS exist
-- in production. RLS policies, triggers, functions, indexes, defaults, and
-- foreign keys are NOT represented here — those live in the numbered
-- migrations src/supabase/migrations/0001..0012 (applied in order). The three
-- legacy artifacts (schema.sql, migrations.consolidated.sql,
-- docs/setup/quiksheets-v2-schema.sql) are DEPRECATED and must not be trusted.
--
-- Generated: ${stamp}
-- Tables: ${tables.length}

`

/** Extract a clean PK/FK hint from PostgREST's column description. */
function hintOf(prop) {
  const d = String(prop.description || '')
  if (/Primary Key/i.test(d)) return 'PK'
  const fk = d.match(/Foreign Key to `?([\w.]+)`?/i)
  if (fk) return `FK -> ${fk[1]}`
  return ''
}

for (const t of tables) {
  const props = defs[t].properties || {}
  const cols = Object.keys(props)
  if (cols.length === 0) continue
  out += `create table if not exists public.${t} (\n`
  out += cols
    .map((c, i) => {
      // Comma goes BEFORE any comment so the comment never eats the separator.
      const base = `  ${c} ${sqlType(props[c])}${i < cols.length - 1 ? ',' : ''}`
      const hint = hintOf(props[c])
      return hint ? `${base}${' '.repeat(Math.max(1, 42 - base.length))}-- ${hint}` : base
    })
    .join('\n')
  out += `\n);\n\n`
}

const outPath = join(ROOT, 'src/supabase/schema.live.generated.sql')
writeFileSync(outPath, out, 'utf8')
console.log(`✓ Wrote ${tables.length} tables to src/supabase/schema.live.generated.sql`)
if (!existsSync(outPath)) process.exit(1)
