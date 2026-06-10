/**
 * Pins the dashboard data-isolation fix: a logged-in user must see ONLY
 * their own user-scoped local workbook blobs — never another user's, never
 * the anon scope, and never the device-global legacy name keys. (The old
 * implementation scanned unscoped `quiksheets_workbook_name:` keys, so a new
 * user on a shared browser saw every workbook previous users had opened.)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readLocalWorkbooks } from '@/features/workbook/useDashboardWorkbooks'

const USER_A = 'user-aaa'
const USER_B = 'user-bbb'

function seed(scope: string, id: string, name: string) {
  window.localStorage.setItem(
    `quiksheets_workbook:${scope}:id:${id}`,
    JSON.stringify({ id, name, data: [], savedAt: '2026-06-09T00:00:00Z' }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  seed(USER_A, 'wb-a1', 'A first')
  seed(USER_A, 'wb-a2', 'A second')
  seed(USER_B, 'wb-b1', 'B private')
  seed('anon', 'wb-anon', 'Anon scratch')
  // Device-global legacy name keys (the old leak vector) — must be ignored.
  window.localStorage.setItem('quiksheets_workbook_name:wb-b1', 'B private')
  window.localStorage.setItem('quiksheets_workbook_name:wb-old', 'Ancient leak')
})

describe('readLocalWorkbooks (user scoping)', () => {
  it('authenticated user sees only their own scoped blobs', () => {
    const rows = readLocalWorkbooks(USER_A)
    expect(rows.map((r) => r.id).sort()).toEqual(['wb-a1', 'wb-a2'])
    expect(rows.find((r) => r.id === 'wb-a1')?.name).toBe('A first')
  })

  it("user B never sees user A's or anon's workbooks", () => {
    const rows = readLocalWorkbooks(USER_B)
    expect(rows.map((r) => r.id)).toEqual(['wb-b1'])
  })

  it('anonymous session sees only the anon scope', () => {
    const rows = readLocalWorkbooks(null)
    expect(rows.map((r) => r.id)).toEqual(['wb-anon'])
  })

  it('legacy unscoped name keys are never listed (the leak vector)', () => {
    for (const scope of [USER_A, USER_B, null]) {
      const ids = readLocalWorkbooks(scope).map((r) => r.id)
      expect(ids).not.toContain('wb-old')
    }
  })
})
