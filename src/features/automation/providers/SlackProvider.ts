/**
 * Real Slack provider — posts to an incoming webhook URL.
 *
 * Configuration is read from the automation's ActionConfig.config:
 *   - webhookUrl: the incoming webhook URL (overrides env)
 *   - message: template string with {{column}} placeholders
 *
 * Fallback: when `webhookUrl` is missing AND `serverEnv.SLACK_WEBHOOK_URL`
 * is also unset, the provider returns ok: false with an "unconfigured"
 * error rather than crashing.
 *
 * The Slack webhook URL is opaque from our perspective — we just POST
 * `{ text }` JSON and trust Slack's auth/routing.
 */

import type { Provider } from './types'
import type { ActionResult, TriggerEvent } from '../types'
import { serverEnv } from '@/lib/env'
import { renderTemplate } from './renderTemplate'

export class SlackProvider implements Provider {
  readonly name = 'slack'

  async send(
    config: Record<string, unknown>,
    event: TriggerEvent,
  ): Promise<ActionResult> {
    const webhookUrl =
      (typeof config.webhookUrl === 'string' && config.webhookUrl) ||
      serverEnv.SLACK_WEBHOOK_URL
    if (!webhookUrl) {
      return { ok: false, error: 'Slack webhook URL not configured (set SLACK_WEBHOOK_URL env or webhookUrl in action config)' }
    }

    const template = typeof config.message === 'string' ? config.message : '{{name}} updated'
    const text = renderTemplate(template, event)

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return { ok: false, error: `Slack returned ${res.status}: ${errText.slice(0, 200)}` }
      }
      return { ok: true, runId: `slack-${Date.now()}` }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Slack POST failed',
      }
    }
  }
}
