/**
 * Real Microsoft Teams provider — posts an Adaptive-Card-flavoured
 * message via the channel's incoming webhook URL.
 *
 * Teams webhooks accept a richer MessageCard payload than Slack's
 * `{text}`, but a bare `{text}` is also accepted and renders as plain
 * text — we use the simple form for portability.
 *
 * Config:
 *   - webhookUrl: incoming webhook URL (overrides env)
 *   - message: template with {{column}} placeholders
 */

import type { Provider } from './types'
import type { ActionResult, TriggerEvent } from '../types'
import { serverEnv } from '@/lib/env'
import { renderTemplate } from './renderTemplate'

export class TeamsProvider implements Provider {
  readonly name = 'teams'

  async send(
    config: Record<string, unknown>,
    event: TriggerEvent,
  ): Promise<ActionResult> {
    const webhookUrl =
      (typeof config.webhookUrl === 'string' && config.webhookUrl) ||
      serverEnv.TEAMS_WEBHOOK_URL
    if (!webhookUrl) {
      return { ok: false, error: 'Teams webhook URL not configured (set TEAMS_WEBHOOK_URL env or webhookUrl in action config)' }
    }

    const template = typeof config.message === 'string' ? config.message : '{{name}} updated'
    const text = renderTemplate(template, event)

    try {
      // Plain text in a minimal MessageCard envelope — works with all
      // current Teams connector versions (Office 365 + Power Automate).
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: 'Quiksheets automation',
          text,
        }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return { ok: false, error: `Teams returned ${res.status}: ${errText.slice(0, 200)}` }
      }
      return { ok: true, runId: `teams-${Date.now()}` }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Teams POST failed',
      }
    }
  }
}
