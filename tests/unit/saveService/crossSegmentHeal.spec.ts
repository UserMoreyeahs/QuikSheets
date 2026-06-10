/**
 * Pins the cross-user-segment localStorage fixes in saveService:
 *
 * 1. loadWorkbookData finds an id-keyed blob written under ANOTHER user
 *    segment (e.g. ':anon:' from an unload flush before auth resolved) and
 *    re-homes it — the "saved data gone after refresh" key-mismatch bug.
 * 2. The legacy UNSCOPED `quiksheets_workbook_<name>` blob is NEVER served
 *    to an authenticated user (cross-user data leak on shared browsers).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSession: { access_token: string; user?: { id: string } } | null = null
let store: Record<string, string> = {}

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: mockSession
            ? {
                access_token: mockSession.access_token,
                ...(mockSession.user ? { user: mockSession.user } : {}),
              }
            : null,
        },
      }),
    },
  }),
}))

beforeEach(() => {
  vi.resetModules()
  mockSession = null
  store = {}
  const ls = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
  vi.stubGlobal('localStorage', ls)
  vi.stubGlobal('window', { localStorage: ls })
})

const WB_ID = '7a000000-0000-4000-8000-000000000001'
const USER = 'user-aaa'

describe('loadWorkbookData cross-segment id heal', () => {
  it("finds a blob saved under ':anon:' when the session is now a real user, and re-homes it", async () => {
    mockSession = { access_token: 't', user: { id: USER } }
    const payload = { id: WB_ID, name: 'Vinay', data: [{ id: 's1' }], savedAt: '2026-06-09T00:00:00Z' }
    store[`quiksheets_workbook:anon:id:${WB_ID}`] = JSON.stringify(payload)

    const { loadWorkbookData } = await import('@/lib/saveService')
    const result = await loadWorkbookData({ id: WB_ID, name: 'Vinay' })

    expect(result?.name).toBe('Vinay')
    expect(result?.id).toBe(WB_ID)
    // Re-homed under the CURRENT user segment for clean future reads.
    expect(store[`quiksheets_workbook:${USER}:id:${WB_ID}`]).toBeTruthy()
  })

  it('prefers the exact current-segment key when both exist', async () => {
    mockSession = { access_token: 't', user: { id: USER } }
    store[`quiksheets_workbook:anon:id:${WB_ID}`] = JSON.stringify({ id: WB_ID, name: 'stale', data: [] })
    store[`quiksheets_workbook:${USER}:id:${WB_ID}`] = JSON.stringify({ id: WB_ID, name: 'fresh', data: [] })

    const { loadWorkbookData } = await import('@/lib/saveService')
    const result = await loadWorkbookData({ id: WB_ID, name: 'whatever' })
    expect(result?.name).toBe('fresh')
  })
})

describe('legacy unscoped blob isolation', () => {
  it('does NOT serve the legacy quiksheets_workbook_<name> blob to an AUTHENTICATED user', async () => {
    mockSession = { access_token: 't', user: { id: USER } }
    // Another person's pre-isolation data on a shared browser:
    store['quiksheets_workbook_Budget'] = JSON.stringify({ name: 'Budget', data: [{ secret: true }] })

    const { loadWorkbookData } = await import('@/lib/saveService')
    const result = await loadWorkbookData({ name: 'Budget' })
    expect(result).toBeNull()
  })

  it('still serves the legacy blob to an UNAUTHENTICATED session (migration path)', async () => {
    mockSession = null
    store['quiksheets_workbook_Budget'] = JSON.stringify({ name: 'Budget', data: [1] })

    const { loadWorkbookData } = await import('@/lib/saveService')
    const result = await loadWorkbookData({ name: 'Budget' })
    expect(result?.name).toBe('Budget')
  })
})
