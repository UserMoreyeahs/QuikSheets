/**
 * One-off migration runner for Quiksheets Supabase setup.
 *
 * Applies a .sql file to the configured Supabase project via a direct
 * Postgres connection (the Supabase REST API doesn't expose arbitrary
 * DDL).
 *
 * Run from repo root:
 *   # Defaults to the full v2 schema:
 *   node docs/setup/apply-migration.js
 *
 *   # Or pass a specific migration file (absolute or relative to root):
 *   node docs/setup/apply-migration.js docs/setup/migrations/comments_table.sql
 *   node docs/setup/apply-migration.js docs/setup/migrations/forms_tables.sql
 *
 * Prereqs:
 *   - PG_PASSWORD env var (the Supabase project's DB password).
 *     Defaults for PG_HOST / PG_REGION / etc. target the configured
 *     project ref `anfvgmlgsthhdhwncxzt`.
 *   - `pg` available as a dependency. It is not pinned in package.json,
 *     so run `npm install pg --no-save` first if you don't have it.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

async function main() {
  // Optional first CLI arg = path to a SQL file. Defaults to the full
  // v2 schema so the existing bootstrap invocation keeps working.
  const argPath = process.argv[2]
  const sqlPath = argPath
    ? (path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath))
    : path.join(__dirname, 'quiksheets-v2-schema.sql')

  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`)
    process.exit(1)
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log(`SQL file: ${sqlPath}`)

  // Supabase moved DB access to regional poolers in 2024. New projects
  // do NOT expose `db.<ref>.supabase.co` — they only accept connections
  // through `aws-0-<region>.pooler.supabase.com:6543` and the postgres
  // user is `postgres.<ref>` (not plain `postgres`).
  const projectRef = process.env.PG_PROJECT_REF ?? 'anfvgmlgsthhdhwncxzt'
  const region     = process.env.PG_REGION     ?? 'ap-southeast-1'
  const prefix     = process.env.PG_PREFIX     ?? 'aws-1'
  const host       = process.env.PG_HOST       ?? `${prefix}-${region}.pooler.supabase.com`
  const port       = Number(process.env.PG_PORT ?? 6543)
  const database   = process.env.PG_DATABASE ?? 'postgres'
  const user       = process.env.PG_USER     ?? `postgres.${projectRef}`
  const password   = process.env.PG_PASSWORD
  if (!password) {
    console.error('Set PG_PASSWORD env var')
    process.exit(1)
  }

  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
    // 60s statement timeout — schema is large but trivially fast.
    statement_timeout: 60_000,
  })

  console.log(`Connecting to ${host}:${port}/${database} as ${user} …`)
  await client.connect()
  console.log('Connected.')

  const t0 = Date.now()
  try {
    await client.query(sql)
    const dt = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`Migration applied in ${dt}s`)
  } catch (err) {
    const dt = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(`Migration failed after ${dt}s`)
    console.error(err.message)
    if (err.position) console.error(`  Position: ${err.position}`)
    if (err.where) console.error(`  Where: ${err.where}`)
    process.exit(2)
  } finally {
    await client.end()
  }

  // Verify the tables landed
  const verify = new Client({
    host, port, database, user, password,
    ssl: { rejectUnauthorized: false },
  })
  await verify.connect()
  const res = await verify.query(`
    select table_name from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `)
  await verify.end()
  console.log(`\nTables in public schema: ${res.rows.length}`)
  for (const row of res.rows) console.log(`  - ${row.table_name}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(3)
})
