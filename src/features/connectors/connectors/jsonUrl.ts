/**
 * JSON-URL Connector
 *
 * Fetches a remote JSON endpoint and extracts an array of objects (or an array
 * of arrays) using a dot-notation path (JSONPath-lite, no library required).
 *
 * Config fields:
 *   url       — Endpoint URL (required)
 *   path      — Dot-notation path to the array within the JSON response.
 *               E.g. "data.results" for `{ data: { results: [...] } }`.
 *               Leave empty if the root itself is the array.
 *   apiKey    — Optional Bearer token sent as Authorization header (secret).
 *
 * Security: `apiKey` is a secret field — stored Supabase-side only.
 */

import type { Connector, FetchResult, CellValue } from '../types'
import { inferColumnTypes } from '../utils/typeInferrer'

export interface JsonUrlConfig {
  url: string
  path?: string
  apiKey?: string
}

const SAMPLE_ROWS = 20

/**
 * Resolve a dot-notation path against a parsed JSON value.
 * Returns `undefined` if any segment is missing.
 *
 * @example
 * resolvePath({ data: { items: [1,2,3] } }, 'data.items') // [1,2,3]
 */
export function resolvePath(
  obj: unknown,
  path: string | undefined
): unknown {
  if (!path || path.trim() === '') return obj
  const segments = path.trim().split('.')
  let current: unknown = obj
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * Flatten one record (object or primitive array) into an ordered CellValue[].
 * `columns` governs the order; missing keys → null.
 */
function flattenRecord(record: unknown, columns: string[]): CellValue[] {
  if (Array.isArray(record)) {
    return columns.map((_, idx) => {
      const v = record[idx]
      return v === undefined || v === null ? null : (v as CellValue)
    })
  }
  if (typeof record === 'object' && record !== null) {
    return columns.map((col) => {
      const v = (record as Record<string, unknown>)[col]
      if (v === undefined || v === null) return null
      if (typeof v === 'object') return JSON.stringify(v)
      return v as CellValue
    })
  }
  // Scalar root — single-column result
  return [record as CellValue]
}

/**
 * Derive ordered column names from the first element of the array.
 * - If element is an object: use sorted keys.
 * - If element is an array: Col1, Col2, …
 * - Otherwise: ["value"]
 */
function deriveColumns(firstItem: unknown): string[] {
  if (Array.isArray(firstItem)) {
    return Array.from({ length: firstItem.length }, (_, i) => `Col${i + 1}`)
  }
  if (typeof firstItem === 'object' && firstItem !== null) {
    return Object.keys(firstItem)
  }
  return ['value']
}

async function fetchJson(config: JsonUrlConfig, maxRows?: number): Promise<FetchResult> {
  const { url, path, apiKey } = config

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON (HTTP ${response.status}): ${url}`)
  }

  const json: unknown = await response.json()
  const resolved = resolvePath(json, path)

  if (!Array.isArray(resolved)) {
    throw new Error(
      `Expected an array at path "${path ?? '<root>'}". ` +
      `Got ${resolved === null ? 'null' : typeof resolved}. ` +
      'Check the "Path" field in the connector configuration.'
    )
  }

  const arr = resolved as unknown[]
  if (arr.length === 0) {
    return { columns: [], rows: [], columnTypes: [], rowCount: 0 }
  }

  const columns = deriveColumns(arr[0])
  const limit = maxRows !== undefined ? Math.min(arr.length, maxRows) : arr.length
  const rows: CellValue[][] = []

  for (let i = 0; i < limit; i += 1) {
    rows.push(flattenRecord(arr[i], columns))
  }

  const columnTypes = inferColumnTypes(columns, rows)

  return { columns, rows, columnTypes, rowCount: rows.length }
}

export const jsonUrlConnector: Connector<JsonUrlConfig> = {
  id: 'json-url',
  name: 'JSON from URL',
  description: 'Fetch any JSON REST endpoint and extract a data array.',
  configSchema: [
    {
      name: 'url',
      label: 'JSON URL',
      kind: 'string',
      required: true,
      placeholder: 'https://api.example.com/data',
    },
    {
      name: 'path',
      label: 'Array path (dot notation)',
      kind: 'string',
      required: false,
      placeholder: 'data.results  (leave blank if root is the array)',
    },
    {
      name: 'apiKey',
      label: 'API key / Bearer token',
      kind: 'secret',
      required: false,
      placeholder: 'sk-…',
    },
  ],

  sample(config) {
    return fetchJson(config, SAMPLE_ROWS)
  },

  fetch(config) {
    return fetchJson(config)
  },
}
