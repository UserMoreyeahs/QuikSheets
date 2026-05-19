import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/features/automation/providers/renderTemplate'
import type { TriggerEvent } from '@/features/automation/types'

const event: TriggerEvent = {
  workbookId: 'wb-1',
  sheetId: 'sheet-1',
  rowIndex: 4,
  type: 'status_changed',
  after: {
    name: 'Acme Inc',
    status: 'Overdue',
    amount: 50000,
    'lead.owner': 'Priya',
  },
}

describe('automation renderTemplate', () => {
  it('substitutes simple placeholders from event.after', () => {
    const out = renderTemplate('Hi {{name}}, status is {{status}}', event)
    expect(out).toBe('Hi Acme Inc, status is Overdue')
  })

  it('coerces non-string values', () => {
    expect(renderTemplate('Total: {{amount}}', event)).toBe('Total: 50000')
  })

  it('handles dotted keys', () => {
    expect(renderTemplate('Owner: {{lead.owner}}', event)).toBe('Owner: Priya')
  })

  it('renders unknown placeholders as empty', () => {
    expect(renderTemplate('{{missing}} — {{name}}', event)).toBe(' — Acme Inc')
  })

  it('tolerates whitespace inside braces', () => {
    expect(renderTemplate('Hi {{  name  }}', event)).toBe('Hi Acme Inc')
  })

  it('returns empty string for empty template', () => {
    expect(renderTemplate('', event)).toBe('')
  })
})
