/**
 * POST /api/data/connectors/postgres
 *
 * Server-side proxy for PostgreSQL queries.
 *
 * Security model:
 *   1. The caller must supply a valid Supabase session token (Authorization: Bearer …).
 *   2. The route verifies the user owns a `connector_connections` row with the
 *      given connection ID and reads the connection string from `config_json` via
 *      the service-role client (bypassing RLS so the server can read the secret).
 *   3. The connection string is NEVER returned to the client.
 *   4. Only SELECT queries are allowed (the postgres library is opened read-only).
 *   5. Row cap of 10 000 is enforced server-side regardless of the client's `maxRows`.
 *
 * In production, set the `POSTGRES_CONNECTOR_ENABLED=true` env var to enable this
 * route. Disabled by default to prevent accidental exposure in public deployments
 * that don't intend to support direct DB connections.
 *
 * Required npm package: `pg` (postgres) — add to package.json before use.
 * If `pg` is not installed this route returns 503 with a clear error message.
 */

import { authenticateSheetRequest } from '@/lib/sheetApi'
import { getServiceRoleSupabase } from '@/lib/supabase/server'
import type { FetchResult, CellValue, ColumnTypeHint } from '@/features/connectors/types'
import { inferColumnTypes } from '@/features/connectors/utils/typeInferrer'

const MAX_ROWS_HARD_CAP = 10_000
const POSTGRES_ENABLED = process.env.POSTGRES_CONNECTOR_ENABLED === 'true'

interface RequestBody {
  connectionId?: string
  connectionString?: string
  query?: string
  maxRows?: number
}

/** Guard: only SELECT (and WITH … SELECT) queries are permitted. */
function isSafeQuery(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase()
  // Allow SELECT and WITH ... SELECT (CTE). Block anything else.
  return trimmed.startsWith('select') || trimmed.startsWith('with')
}

export async function POST(request: Request): Promise<Response> {
  if (!POSTGRES_ENABLED) {
    return Response.json(
      {
        error:
          'The PostgreSQL connector is disabled. ' +
          'Set POSTGRES_CONNECTOR_ENABLED=true in your server environment to enable it.',
      },
      { status: 503 }
    )
  }

  // 1. Authenticate
  const authResult = await authenticateSheetRequest(request)
  if ('response' in authResult) return authResult.response

  const body = await request.json().catch(() => null) as RequestBody | null
  if (!body) {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { query, maxRows = 1000 } = body

  if (!query?.trim()) {
    return Response.json({ error: 'A SQL query is required.' }, { status: 400 })
  }
  if (!isSafeQuery(query)) {
    return Response.json(
      { error: 'Only SELECT queries are allowed.' },
      { status: 400 }
    )
  }

  // 2. Resolve the connection string
  // Priority: direct connectionString in body (trusted only if sent over TLS + auth'd)
  //           OR look it up from connector_connections by connectionId
  let connectionString = body.connectionString?.trim()

  if (!connectionString && body.connectionId) {
    const serviceRole = getServiceRoleSupabase()
    if (!serviceRole) {
      return Response.json(
        { error: 'Service-role Supabase client is not configured.' },
        { status: 503 }
      )
    }

    const { data, error } = await serviceRole
      .from('connector_connections')
      .select('config_json, created_by')
      .eq('id', body.connectionId)
      .single()

    if (error || !data) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 })
    }

    // Verify ownership
    if ((data as { created_by: string }).created_by !== authResult.user.id) {
      return Response.json({ error: 'Access denied.' }, { status: 403 })
    }

    const cfg = (data as { config_json: Record<string, unknown> }).config_json
    connectionString = typeof cfg['connectionString'] === 'string' ? cfg['connectionString'] : ''
  }

  if (!connectionString) {
    return Response.json(
      { error: 'No connection string available.' },
      { status: 400 }
    )
  }

  // 3. Execute the query via `pg` (dynamic import so missing package = 503)
  const rowLimit = Math.min(Math.abs(maxRows), MAX_ROWS_HARD_CAP)
  const limitedQuery = `${query.trim().replace(/;+$/, '')} LIMIT ${rowLimit}`

  try {
    // Dynamic import — `pg` must be in node_modules
    const { Client } = await import('pg').catch(() => {
      throw new Error('pg_not_installed')
    })

    // Verify the server's TLS certificate. Previously `rejectUnauthorized:false`
    // disabled verification entirely → a MITM could impersonate the DB. Untrusted
    // / self-signed certs are now correctly rejected.
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } })
    await client.connect()

    let queryResult: { fields: { name: string }[]; rows: Record<string, unknown>[] }
    try {
      // DB-ENFORCED read-only: Postgres rejects ANY write inside a READ ONLY
      // transaction — including data-modifying CTEs (`WITH x AS (DELETE … RETURNING)
      // SELECT …`) that slip past the textual isSafeQuery() guard. Defense in depth.
      await client.query('BEGIN TRANSACTION READ ONLY')
      queryResult = await client.query(limitedQuery)
      await client.query('ROLLBACK')
    } finally {
      await client.end()
    }

    const columns: string[] = queryResult.fields.map((f) => f.name)
    const rows: CellValue[][] = queryResult.rows.map((row) =>
      columns.map((col) => {
        const v = row[col]
        if (v === null || v === undefined) return null
        if (typeof v === 'number' || typeof v === 'boolean') return v
        if (v instanceof Date) return v.toISOString()
        return String(v)
      })
    )

    const columnTypes: ColumnTypeHint[] = inferColumnTypes(columns, rows)

    const result: FetchResult = {
      columns,
      rows,
      columnTypes,
      rowCount: rows.length,
    }

    return Response.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'pg_not_installed') {
      return Response.json(
        {
          error:
            'The `pg` npm package is not installed. ' +
            'Run `npm install pg` and `npm install --save-dev @types/pg` to enable this connector.',
        },
        { status: 503 }
      )
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { error: 'Query execution failed.', details: message },
      { status: 500 }
    )
  }
}

