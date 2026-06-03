import { describe, it, expect } from 'vitest'
import { MockProvider } from '@/features/automation/providers/MockProvider'
import type { TriggerEvent } from '@/features/automation/types'

const baseEvent: TriggerEvent = {
  workbookId: 'wb-1',
  sheetId: 'sheet-1',
  rowIndex: 3,
  type: 'status_changed',
  before: { 2: 'Active' },
  after: { 2: 'Overdue' },
}

describe('MockProvider', () => {
  it('always returns ok: true', async () => {
    const provider = new MockProvider('email')
    const result = await provider.send({}, baseEvent)
    expect(result.ok).toBe(true)
  })

  it('includes a runId in the result', async () => {
    const provider = new MockProvider('slack')
    const result = await provider.send({}, baseEvent)
    expect(result.runId).toBeTruthy()
    expect(typeof result.runId).toBe('string')
  })

  it('runId encodes the trigger type', async () => {
    const provider = new MockProvider('teams')
    const result = await provider.send({}, baseEvent)
    expect(result.runId).toContain('status_changed')
  })

  it('name reflects the provider type passed to constructor', () => {
    expect(new MockProvider('email').name).toBe('mock:email')
    expect(new MockProvider('whatsapp').name).toBe('mock:whatsapp')
    expect(new MockProvider('task').name).toBe('mock:task')
  })

  it('works for row_created events', async () => {
    const provider = new MockProvider('email')
    const createdEvent: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: 'sheet-1',
      rowIndex: 10,
      type: 'row_created',
      after: { 0: 'Alice', 1: 'New' },
    }
    const result = await provider.send({ to: 'a@b.com' }, createdEvent)
    expect(result.ok).toBe(true)
    expect(result.runId).toContain('row_created')
  })

  it('works for row_updated events', async () => {
    const provider = new MockProvider('slack')
    const updatedEvent: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: 'sheet-1',
      rowIndex: 2,
      type: 'row_updated',
      before: { 0: 'old' },
      after: { 0: 'new' },
    }
    const result = await provider.send({ text: 'update' }, updatedEvent)
    expect(result.ok).toBe(true)
  })
})
