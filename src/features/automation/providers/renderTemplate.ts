/**
 * Tiny template renderer for automation message bodies.
 *
 * Substitutes `{{key}}` placeholders with values from the event's
 * `after` row payload. Unknown placeholders are left blank (not
 * the literal text) so the rendered message stays clean.
 *
 * Used by Email, Slack, Teams, and WhatsApp providers.
 *
 * Example:
 *   template = "Status changed to {{status}} for {{name}}"
 *   event.after = { status: "Overdue", name: "Acme Inc" }
 *   → "Status changed to Overdue for Acme Inc"
 */

import type { TriggerEvent } from '../types'

export function renderTemplate(template: string, event: TriggerEvent): string {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const v = event.after[key]
    if (v === undefined || v === null) return ''
    return String(v)
  })
}
