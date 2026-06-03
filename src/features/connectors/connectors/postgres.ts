/**
 * PostgreSQL Connector (client side)
 *
 * This connector does NOT connect to Postgres directly from the browser.
 * Instead it sends the user's config to a server-side proxy route:
 *   POST /api/data/connectors/postgres
 *
 * The server route decrypts the stored connection string (via the Supabase
 * service-role client) and executes the SELECT query in a sandboxed manner.
 *
 * Config fields:
 *   connectionString — postgresql://user:pass@host:5432/db (secret — server only)
 *   query            — SELECT statement to execute (required)
 *   maxRows          — Row cap for safety (default 1 000, max 10 000)
 *
 * Security:
 *   `connectionString` is a `kind: 'secret'` field. The connector builder
 *   stores it encrypted in Supabase (never in localStorage). The proxy route
 *   reads it via the service-role client and never echoes it back.
 */

import type { Connector, FetchResult } from '../types'

export interface PostgresConfig {
  connectionString: string
  query: string
  maxRows?: number
}

const PROXY_ROUTE = '/api/data/connectors/postgres'

async function queryPostgres(config: PostgresConfig, sampleMode = false): Promise<FetchResult> {
  const { connectionString, query, maxRows = 1000 } = config

  if (!connectionString.trim()) throw new Error('Connection string is required.')
  if (!query.trim()) throw new Error('SQL query is required.')

  const response = await fetch(PROXY_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connectionString,
      query,
      maxRows: sampleMode ? 20 : maxRows,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      (typeof body['error'] === 'string' ? body['error'] : null) ??
      `Postgres proxy returned HTTP ${response.status}.`
    )
  }

  return response.json() as Promise<FetchResult>
}

export const postgresConnector: Connector<PostgresConfig> = {
  id: 'postgres',
  name: 'PostgreSQL',
  description: 'Run a SELECT query against your Postgres database via a secure server proxy.',
  configSchema: [
    {
      name: 'connectionString',
      label: 'Connection string',
      kind: 'secret',
      required: true,
      placeholder: 'postgresql://user:password@host:5432/database',
    },
    {
      name: 'query',
      label: 'SQL query (SELECT only)',
      kind: 'textarea',
      required: true,
      placeholder: 'SELECT id, name, revenue FROM sales ORDER BY revenue DESC LIMIT 500',
    },
    {
      name: 'maxRows',
      label: 'Max rows',
      kind: 'number',
      required: false,
      defaultValue: 1000,
      placeholder: '1000',
    },
  ],

  sample(config) {
    return queryPostgres(config, true)
  },

  fetch(config) {
    return queryPostgres(config, false)
  },
}
