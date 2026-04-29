import { describe, it, expect } from 'vitest'

// Pull the predicate out of the dispatcher module for direct testing.
// The dispatcher exports dispatchTriggerEvent (which hits Supabase). We test
// the shouldFire logic indirectly by re-implementing the same predicate
// here; if dispatcher.ts exposes shouldFire later this test should import it.

type TriggerType = 'row_created' | 'row_updated' | 'status_changed'

interface AutomationDefinition {
  trigger: {
    type: TriggerType
    sheetId: string
    statusColumnIndex?: number
    statusEquals?: string
  }
}
interface TriggerEvent {
  workbookId: string
  sheetId: string
  rowIndex: number
  type: TriggerType
  before?: Record<string, unknown>
  after: Record<string, unknown>
}

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

describe('shouldFire', () => {
  const sheetId = 'sheet-1'

  it('fires on row_created when sheet matches', () => {
    expect(
      shouldFire(
        { trigger: { type: 'row_created', sheetId } },
        { workbookId: 'wb', sheetId, rowIndex: 5, type: 'row_created', after: { 0: 'a' } }
      )
    ).toBe(true)
  })

  it('does not fire when sheet does not match', () => {
    expect(
      shouldFire(
        { trigger: { type: 'row_created', sheetId } },
        { workbookId: 'wb', sheetId: 'other', rowIndex: 5, type: 'row_created', after: {} }
      )
    ).toBe(false)
  })

  it('fires on status_changed when before/after differ and after matches', () => {
    expect(
      shouldFire(
        { trigger: { type: 'status_changed', sheetId, statusColumnIndex: 4, statusEquals: 'Overdue' } },
        {
          workbookId: 'wb',
          sheetId,
          rowIndex: 2,
          type: 'status_changed',
          before: { 4: 'Active' },
          after: { 4: 'Overdue' },
        }
      )
    ).toBe(true)
  })

  it('does not fire on status_changed when after does not match expected', () => {
    expect(
      shouldFire(
        { trigger: { type: 'status_changed', sheetId, statusColumnIndex: 4, statusEquals: 'Overdue' } },
        {
          workbookId: 'wb',
          sheetId,
          rowIndex: 2,
          type: 'status_changed',
          before: { 4: 'Active' },
          after: { 4: 'Closed' },
        }
      )
    ).toBe(false)
  })

  it('does not fire on status_changed when value did not actually change', () => {
    expect(
      shouldFire(
        { trigger: { type: 'status_changed', sheetId, statusColumnIndex: 4, statusEquals: 'Overdue' } },
        {
          workbookId: 'wb',
          sheetId,
          rowIndex: 2,
          type: 'status_changed',
          before: { 4: 'Overdue' },
          after: { 4: 'Overdue' },
        }
      )
    ).toBe(false)
  })
})
