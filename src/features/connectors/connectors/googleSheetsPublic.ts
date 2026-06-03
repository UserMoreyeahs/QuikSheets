/**
 * Google Sheets (public) Connector
 *
 * Reads a publicly shared Google Spreadsheet without OAuth by using the
 * Google Sheets CSV export URL:
 *   https://docs.google.com/spreadsheets/d/{spreadsheetId}/export?format=csv&gid={gid}
 *
 * Requirements:
 *   - The spreadsheet must be shared as "Anyone with the link can view".
 *   - Only reads the first 1 MB of CSV (browser fetch limit).
 *
 * Config fields:
 *   spreadsheetId — The long ID from the Google Sheets URL (required)
 *   gid           — Sheet tab ID (default "0" = first sheet)
 *   hasHeader     — Whether row 1 is a header (default true)
 *
 * Security: no secret fields. Config is safe for localStorage.
 */

import type { Connector, FetchResult } from '../types'
import { csvUrlConnector } from './csvUrl'

export interface GoogleSheetsPublicConfig {
  spreadsheetId: string
  gid?: string
  hasHeader?: boolean
}

function buildExportUrl(spreadsheetId: string, gid = '0'): string {
  return (
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}` +
    `/export?format=csv&gid=${encodeURIComponent(gid)}`
  )
}

async function fetchGoogleSheets(
  config: GoogleSheetsPublicConfig,
  maxRows?: number
): Promise<FetchResult> {
  const { spreadsheetId, gid = '0', hasHeader = true } = config
  if (!spreadsheetId.trim()) {
    throw new Error('Spreadsheet ID is required.')
  }

  const url = buildExportUrl(spreadsheetId, gid)

  // Delegate to the CSV connector (same CSV parsing logic)
  const csvConfig = { url, hasHeader, delimiter: ',' }

  if (maxRows !== undefined) {
    return csvUrlConnector.sample(csvConfig)
  }
  return csvUrlConnector.fetch(csvConfig)
}

export const googleSheetsPublicConnector: Connector<GoogleSheetsPublicConfig> = {
  id: 'google-sheets-public',
  name: 'Google Sheets (public)',
  description: 'Import from any publicly shared Google Spreadsheet — no sign-in required.',
  configSchema: [
    {
      name: 'spreadsheetId',
      label: 'Spreadsheet ID',
      kind: 'string',
      required: true,
      placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
    },
    {
      name: 'gid',
      label: 'Sheet tab ID (gid)',
      kind: 'string',
      required: false,
      placeholder: '0  (0 = first sheet)',
      defaultValue: '0',
    },
    {
      name: 'hasHeader',
      label: 'First row is header',
      kind: 'boolean',
      required: false,
      defaultValue: true,
    },
  ],

  sample(config) {
    return fetchGoogleSheets(config, 20)
  },

  fetch(config) {
    return fetchGoogleSheets(config)
  },
}
