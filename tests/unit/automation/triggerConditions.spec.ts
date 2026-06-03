import { describe, it, expect } from 'vitest'
import { buildEvent } from '@/features/automation/triggerClient'
import type { AutomationDefinition, TriggerEvent } from '@/features/automation/types'

// Re-export shouldFire logic for unit testing — mirrors dispatcher.ts exactly.
// If dispatcher.ts ever exports shouldFire directly, import from there instead.
function shouldFire(automation: AutomationDefinition, event: TriggerEvent): boolean {
  if (automation.trigger.type !== event.type) return false
  if (automation.trigger.sheetId !== event.sheetId) return false

  if (event.type === 'status_changed') {
    const col = automation.trigger.statusColumnIndex
    const expected = automation.trigger.statusEquals
    if (col === undefined || expected === undefined) return false
    const beforeVal = event.before?.[String(col)]
    const afterVal = event.after?.[String(col)]
    return beforeVal !== afterVal && String(afterVal) === expected
  }

  return true
}

const SHEET_ID = 'sheet-abc'

describe('shouldFire — status_changed (T020 acceptance scenario)', () => {
  const automation: AutomationDefinition = {
    workbookId: 'wb-1',
    name: 'Status alert',
    enabled: true,
    trigger: {
      type: 'status_changed',
      sheetId: SHEET_ID,
      statusColumnIndex: 2,
      statusEquals: 'Overdue',
    },
    action: { type: 'slack', config: { text: 'Row is Overdue' } },
  }

  it('fires when status changes to the target value', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 4,
      type: 'status_changed',
      before: { '2': 'Active' },
      after: { '2': 'Overdue' },
    }
    expect(shouldFire(automation, event)).toBe(true)
  })

  it('does not fire when the new value is not the target', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 4,
      type: 'status_changed',
      before: { '2': 'Active' },
      after: { '2': 'Closed' },
    }
    expect(shouldFire(automation, event)).toBe(false)
  })

  it('does not fire when the value did not change', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 4,
      type: 'status_changed',
      before: { '2': 'Overdue' },
      after: { '2': 'Overdue' },
    }
    expect(shouldFire(automation, event)).toBe(false)
  })

  it('does not fire when event is for a different sheet', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: 'other-sheet',
      rowIndex: 4,
      type: 'status_changed',
      before: { '2': 'Active' },
      after: { '2': 'Overdue' },
    }
    expect(shouldFire(automation, event)).toBe(false)
  })

  it('does not fire when trigger type does not match event type', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 4,
      type: 'row_updated',
      before: { '2': 'Active' },
      after: { '2': 'Overdue' },
    }
    expect(shouldFire(automation, event)).toBe(false)
  })
})

describe('shouldFire — row_created / row_updated', () => {
  const rowCreatedAutomation: AutomationDefinition = {
    workbookId: 'wb-1',
    name: 'New row',
    enabled: true,
    trigger: { type: 'row_created', sheetId: SHEET_ID },
    action: { type: 'email', config: { to: 'admin@example.com' } },
  }

  it('fires on row_created when sheet matches', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 5,
      type: 'row_created',
      after: { '0': 'Alice' },
    }
    expect(shouldFire(rowCreatedAutomation, event)).toBe(true)
  })

  it('does not fire row_created when sheet differs', () => {
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: 'other',
      rowIndex: 5,
      type: 'row_created',
      after: { '0': 'Alice' },
    }
    expect(shouldFire(rowCreatedAutomation, event)).toBe(false)
  })

  it('fires on row_updated', () => {
    const automation: AutomationDefinition = {
      workbookId: 'wb-1',
      name: 'Row update',
      enabled: true,
      trigger: { type: 'row_updated', sheetId: SHEET_ID },
      action: { type: 'teams', config: { text: 'Row changed' } },
    }
    const event: TriggerEvent = {
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 2,
      type: 'row_updated',
      before: { '0': 'old' },
      after: { '0': 'new' },
    }
    expect(shouldFire(automation, event)).toBe(true)
  })
})

describe('buildEvent helper', () => {
  it('builds a row_created event with no before field when beforeRow is absent', () => {
    const event = buildEvent({
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 7,
      type: 'row_created',
      afterRow: ['Alice', 'alice@example.com', 'New'],
    })
    expect(event.type).toBe('row_created')
    expect(event.before).toBeUndefined()
    expect(event.after['0']).toBe('Alice')
    expect(event.after['2']).toBe('New')
  })

  it('builds a status_changed event with before and after keyed by column index', () => {
    const event = buildEvent({
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 3,
      type: 'status_changed',
      beforeRow: ['Bob', 'bob@example.com', 'Active'],
      afterRow: ['Bob', 'bob@example.com', 'Overdue'],
    })
    expect(event.type).toBe('status_changed')
    expect(event.before?.['2']).toBe('Active')
    expect(event.after['2']).toBe('Overdue')
  })

  it('accepts numeric and null values in rows', () => {
    const event = buildEvent({
      workbookId: 'wb-1',
      sheetId: SHEET_ID,
      rowIndex: 1,
      type: 'row_updated',
      beforeRow: [100, null, 'pending'],
      afterRow: [200, null, 'done'],
    })
    expect(event.after['0']).toBe(200)
    expect(event.after['1']).toBeNull()
  })
})
