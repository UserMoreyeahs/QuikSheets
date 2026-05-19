'use client'

/**
 * Client-side trigger helper for the automation engine.
 *
 * Used by the spreadsheet grid's afterCellEdit handler. Builds a
 * minimal `TriggerEvent` row payload from the cell change, POSTs it to
 * `/api/automation/dispatch`, and discards the response (the API is
 * fire-and-forget by design).
 *
 * Two reasons we go through HTTP instead of calling the dispatcher
 * directly:
 *   1. The dispatcher reads from Supabase with the service-role key
 *      which must never be exposed to the browser.
 *   2. Server-side execution gives us per-user rate limiting and a
 *      single audit trail in `automation_runs`.
 *
 * Failures (network drop, server 5xx) are swallowed; we never want a
 * broken automation pipeline to block a user's cell edit.
 */

import type { TriggerEvent } from './types'

/** Best-effort POST — never throws, never blocks the caller. */
export function fireTrigger(event: TriggerEvent): void {
  // Skip in SSR (build) and when an obvious required field is missing.
  if (typeof window === 'undefined') return
  if (!event.workbookId || !event.sheetId) return

  // We deliberately don't await; the caller's edit path stays snappy.
  void fetch('/api/automation/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    // `keepalive` lets the request finish even if the user navigates
    // away mid-flight — important since automation delivery is the
    // last step in the cell-edit lifecycle.
    keepalive: true,
  }).catch(() => {
    // Silently drop: failures are logged server-side in automation_runs
    // when the request reached the server; client-side network errors
    // are not worth surfacing to the user.
  })
}

/**
 * Build a TriggerEvent from a cell change.
 *
 * `before` and `after` are full row snapshots keyed by column index
 * (as string) so the dispatcher can evaluate status-changed conditions
 * regardless of which column was actually edited.
 */
export function buildEvent(args: {
  workbookId: string
  sheetId: string
  rowIndex: number
  type: TriggerEvent['type']
  beforeRow?: unknown[]
  afterRow: unknown[]
}): TriggerEvent {
  const before = args.beforeRow
    ? Object.fromEntries(args.beforeRow.map((v, i) => [String(i), v]))
    : undefined
  const after = Object.fromEntries(args.afterRow.map((v, i) => [String(i), v]))
  return {
    workbookId: args.workbookId,
    sheetId: args.sheetId,
    rowIndex: args.rowIndex,
    type: args.type,
    ...(before ? { before } : {}),
    after,
  }
}
