/**
 * Real WhatsApp provider — sends via Twilio's WhatsApp API.
 *
 * Requires:
 *   - TWILIO_ACCOUNT_SID     — your Twilio account SID
 *   - TWILIO_AUTH_TOKEN      — your Twilio auth token
 *   - TWILIO_WHATSAPP_FROM   — e.g. "whatsapp:+14155238886" (Twilio sandbox)
 *
 * Per-action config:
 *   - to: "whatsapp:+<E.164 number>" (e.g. "whatsapp:+919876543210")
 *   - message: template with {{column}} placeholders
 *
 * Notes:
 *   - In Twilio's sandbox the recipient must opt-in by texting the
 *     `join <code>` keyword to the Twilio number first. The provider
 *     doesn't enforce this — it just relays Twilio's error if delivery
 *     fails.
 *   - To use a Twilio production WhatsApp sender you must complete
 *     Meta's business verification. Until then keep `WHATSAPP_PROVIDER`
 *     set to 'mock' for non-sandbox environments.
 */

import type { Provider } from './types'
import type { ActionResult, TriggerEvent } from '../types'
import { serverEnv } from '@/lib/env'
import { renderTemplate } from './renderTemplate'

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01/Accounts'

export class WhatsAppProvider implements Provider {
  readonly name = 'whatsapp'

  async send(
    config: Record<string, unknown>,
    event: TriggerEvent,
  ): Promise<ActionResult> {
    const sid = serverEnv.TWILIO_ACCOUNT_SID
    const token = serverEnv.TWILIO_AUTH_TOKEN
    const from = serverEnv.TWILIO_WHATSAPP_FROM

    if (!sid || !token || !from) {
      return {
        ok: false,
        error: 'WhatsApp provider not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)',
      }
    }

    const to = typeof config.to === 'string' ? config.to.trim() : ''
    if (!to) {
      return { ok: false, error: 'WhatsApp action requires `to` E.164 number (e.g. whatsapp:+919876543210)' }
    }

    const template =
      typeof config.message === 'string' ? config.message : 'Update from Quiksheets'
    const body = renderTemplate(template, event)

    const url = `${TWILIO_BASE}/${sid}/Messages.json`
    const params = new URLSearchParams({ From: from, To: to, Body: body })

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        },
        body: params.toString(),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return { ok: false, error: `Twilio returned ${res.status}: ${errText.slice(0, 200)}` }
      }
      const data = (await res.json().catch(() => ({}))) as { sid?: string }
      return { ok: true, runId: data.sid ?? `wa-${Date.now()}` }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Twilio request failed',
      }
    }
  }
}
