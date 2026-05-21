/**
 * Real email provider — sends via Resend's HTTP API.
 *
 * Resend was chosen over SendGrid / Mailgun for: zero-setup free tier,
 * simple POST API, and minimal SDK dependency (we use plain fetch).
 *
 * Config:
 *   - to: recipient email address (required)
 *   - from: sender (optional; falls back to RESEND_FROM env)
 *   - subject: template string for the subject line
 *   - body: template string for the email body
 *
 * The action fails fast with a clear message if RESEND_API_KEY is
 * missing rather than silently dropping the email.
 *
 * For more complex needs (attachments, HTML emails, batch send), swap
 * the body of `send()` for the Resend SDK — the surface contract stays
 * the same.
 */

import type { Provider } from './types'
import type { ActionResult, TriggerEvent } from '../types'
import { serverEnv } from '@/lib/env'
import { renderTemplate } from './renderTemplate'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export class EmailProvider implements Provider {
  readonly name = 'email'

  async send(
    config: Record<string, unknown>,
    event: TriggerEvent,
  ): Promise<ActionResult> {
    const apiKey = serverEnv.RESEND_API_KEY
    if (!apiKey) {
      return { ok: false, error: 'Email provider not configured (set RESEND_API_KEY)' }
    }

    const to = typeof config.to === 'string' ? config.to.trim() : ''
    if (!to) {
      return { ok: false, error: 'Email action requires `to` recipient address' }
    }

    const from =
      (typeof config.from === 'string' && config.from) ||
      serverEnv.RESEND_FROM ||
      'Quiksheets <noreply@quiksheets.app>'

    const subjectTemplate =
      typeof config.subject === 'string' ? config.subject : 'Update from Quiksheets'
    const bodyTemplate =
      typeof config.body === 'string' ? config.body : 'Row updated.'

    const subject = renderTemplate(subjectTemplate, event)
    const text = renderTemplate(bodyTemplate, event)

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, text }),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        return { ok: false, error: `Resend returned ${res.status}: ${errBody.slice(0, 200)}` }
      }
      const { id } = (await res.json().catch(() => ({ id: undefined }))) as { id?: string }
      return { ok: true, runId: id ?? `email-${Date.now()}` }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Resend request failed',
      }
    }
  }
}
