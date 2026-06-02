/**
 * REST API Connector
 *
 * Generic GET endpoint with:
 *   - Optional Bearer token / API key header (secret)
 *   - JSONPath-lite response selector (reuses resolvePath from jsonUrl.ts)
 *   - Optional custom header name (defaults to "Authorization")
 *
 * Config fields:
 *   url         — Endpoint URL (required)
 *   path        — Dot-notation path to the array in the response
 *   apiKeyName  — Header name for the API key (default "Authorization")
 *   apiKeyValue — API key / token value (secret)
 *   apiKeyPrefix — Prefix before the key value (e.g. "Bearer ", "Token ")
 *
 * Security: `apiKeyValue` is a secret field — stored Supabase-side only.
 */

import type { Connector, FetchResult } from '../types'
import { resolvePath } from './jsonUrl'
import { inferColumnTypes } from '../utils/typeInferrer'
import type { CellValue } from '../types'

export interface RestApiConfig {
  url: string
  path?: string
  apiKeyName?: string
  apiKeyValue?: string
  apiKeyPrefix?: string
}

const SAMPLE_ROWS = 20

function flattenItem(item: unknown, columns: string[]): CellValue[] {
  if (Array.isArray(item)) {
    return columns.map((_, idx) => {
      const v = item[idx]
      return v === undefined || v === null ? null : (v as CellValue)
    })
  }
  if (typeof item === 'object' && item !== null) {
    return columns.map((col) => {
      const v = (item as Record<string, unknown>)[col]
      if (v === undefined || v === null) return null
      if (typeof v === 'object') return JSON.stringify(v)
      return v as CellValue
    })
  }
  return [item as CellValue]
}

function deriveColumns(firstItem: unknown): string[] {
  if (Array.isArray(firstItem)) {
    return Array.from({ length: firstItem.length }, (_, i) => `Col${i + 1}`)
  }
  if (typeof firstItem === 'object' && firstItem !== null) {
    return Object.keys(firstItem)
  }
  return ['value']
}

async function callRestApi(config: RestApiConfig, maxRows?: number): Promise<FetchResult> {
  const {
    url,
    path,
    apiKeyName = 'Authorization',
    apiKeyValue,
    apiKeyPrefix = 'Bearer ',
  } = config

  if (!url.trim()) throw new Error('URL is required.')

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKeyValue) {
    headers[apiKeyName] = `${apiKeyPrefix}${apiKeyValue}`
  }

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`REST API returned HTTP ${response.status}: ${url}`)
  }

  const json: unknown = await response.json()
  const resolved = resolvePath(json, path)

  if (!Array.isArray(resolved)) {
    throw new Error(
      `Expected an array at path "${path ?? '<root>'}". ` +
      `Got ${resolved === null ? 'null' : typeof resolved}. ` +
      'Adjust the "Array path" field.'
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
    rows.push(flattenItem(arr[i], columns))
  }

  const columnTypes = inferColumnTypes(columns, rows)

  return { columns, rows, columnTypes, rowCount: rows.length }
}

export const restApiConnector: Connector<RestApiConfig> = {
  id: 'rest-api',
  name: 'REST API',
  description: 'Connect to any GET REST endpoint with optional API-key authentication.',
  configSchema: [
    {
      name: 'url',
      label: 'Endpoint URL',
      kind: 'string',
      required: true,
      placeholder: 'https://api.example.com/v1/records',
    },
    {
      name: 'path',
      label: 'Array path (dot notation)',
      kind: 'string',
      required: false,
      placeholder: 'data.items  (blank = root is the array)',
    },
    {
      name: 'apiKeyName',
      label: 'Auth header name',
      kind: 'string',
      required: false,
      placeholder: 'Authorization',
      defaultValue: 'Authorization',
    },
    {
      name: 'apiKeyPrefix',
      label: 'Auth header prefix',
      kind: 'string',
      required: false,
      placeholder: 'Bearer ',
      defaultValue: 'Bearer ',
    },
    {
      name: 'apiKeyValue',
      label: 'API key / token',
      kind: 'secret',
      required: false,
      placeholder: 'sk-…',
    },
  ],

  sample(config) {
    return callRestApi(config, SAMPLE_ROWS)
  },

  fetch(config) {
    return callRestApi(config)
  },
}
