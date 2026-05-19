/**
 * POST /api/automation/dispatch
 *
 * Server entry point for the automation engine. Receives a `TriggerEvent`
 * payload from the client (typically fired from SpreadsheetGrid when a
 * row mutates) and runs `dispatchTriggerEvent`, which looks up matching
 * automations and executes their actions.
 *
 * Auth: requires an authenticated Supabase user. Per-event work is
 * rate-limited so a runaway client can't spam providers.
 *
 * Response: 202 Accepted on success (we return before all providers
 * finish — fire-and-forget per Excel/Sheets conventions). Returns 4xx
 * on auth or validation failures.
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'
import { dispatchTriggerEvent } from '@/features/automation/dispatcher'
import { getServerSupabase } from '@/lib/supabase/server'
import { consumeToken } from '@/lib/rateLimit'

const eventSchema = z.object({
  workbookId: z.string().uuid(),
  sheetId: z.string().min(1),
  rowIndex: z.number().int().nonnegative(),
  type: z.enum(['row_created', 'row_updated', 'status_changed']),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()),
})

export async function POST(request: Request) {
  // Auth check — automations run as the authenticated user.
  const supabase = await getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Per-user rate limit — shares the AI-route bucket since automations
  // are a similar cost class (one HTTP-out per fire) and we don't want
  // a runaway client to spam Resend/Slack.
  const rl = consumeToken(`automation:${user.id}`)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Automation dispatch rate limit exceeded', retryAfter: Math.ceil((rl.retryAfterMs ?? 60_000) / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }

  // Parse + validate body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid event payload', details: parsed.error.message }, { status: 400 })
  }

  // Fire-and-forget. The dispatcher writes to `automation_runs` so the
  // outcome is observable from the UI; we don't make the client wait.
  void dispatchTriggerEvent(parsed.data).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[automation] dispatch failed', err)
  })

  return NextResponse.json({ accepted: true }, { status: 202 })
}
