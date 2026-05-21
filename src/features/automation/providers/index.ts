/**
 * Provider registry.
 *
 * Returns a real adapter when the corresponding `*_PROVIDER` env var is
 * anything other than 'mock' (default). The real adapters degrade
 * gracefully when their own credentials are absent: they return
 * `{ ok: false, error: '… not configured' }` rather than throwing, so
 * the dispatcher's per-automation run row still records the failure.
 *
 * To enable real delivery in dev:
 *   EMAIL_PROVIDER=real    RESEND_API_KEY=...   RESEND_FROM=...
 *   SLACK_PROVIDER=real    SLACK_WEBHOOK_URL=...
 *   TEAMS_PROVIDER=real    TEAMS_WEBHOOK_URL=...
 *   WHATSAPP_PROVIDER=real TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_WHATSAPP_FROM=...
 */

import { serverEnv } from '@/lib/env'
import { MockProvider } from './MockProvider'
import { EmailProvider } from './EmailProvider'
import { SlackProvider } from './SlackProvider'
import { TeamsProvider } from './TeamsProvider'
import { WhatsAppProvider } from './WhatsAppProvider'
import type { Provider } from './types'
import type { ActionType } from '../types'

export function getProvider(type: ActionType): Provider {
  switch (type) {
    case 'email':
      return serverEnv.EMAIL_PROVIDER !== 'mock' ? new EmailProvider() : new MockProvider('email')
    case 'slack':
      return serverEnv.SLACK_PROVIDER !== 'mock' ? new SlackProvider() : new MockProvider('slack')
    case 'teams':
      return serverEnv.TEAMS_PROVIDER !== 'mock' ? new TeamsProvider() : new MockProvider('teams')
    case 'whatsapp':
      return serverEnv.WHATSAPP_PROVIDER !== 'mock'
        ? new WhatsAppProvider()
        : new MockProvider('whatsapp')
    case 'task':
      // Task provider stays mock-only for now — tasks should land in
      // the internal task list once that surface ships. Returning a
      // MockProvider ensures automations referencing 'task' don't crash.
      return new MockProvider('task')
  }
}
