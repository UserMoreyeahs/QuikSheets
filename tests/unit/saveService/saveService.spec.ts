/**
 * Contract tests for src/lib/saveService.ts.
 *
 * MVP T012 invariant: when a logged-in user edits a cell, the change
 * must flow to Supabase (via POST /api/sheet) — NOT just to
 * localStorage. Before the T012 fix this was silently broken.
 *
 * We exercise the three branches:
 *   1. No session → localStorage fallback
 *   2. Session + 200 OK → reports destination: 'supabase' with id
 *   3. Session + non-2xx → localStorage fallback with reason
 *
 * Data-isolation invariant (this revision): the localStorage fallback is
 * keyed by workbook IDENTITY (and by user when a Supabase user id is
 * available), NOT by workbook name. Two workbooks named the same must not
 * collide. `loadWorkbook` migrates entries written under the OLD
 * name-based key.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const SESSION_TOKEN = 'mock-access-token'
const LEGACY_KEY_PREFIX = 'quiksheets_workbook'

// The mocked session can now carry a user id so we can assert per-user
// key scoping. `undefined` user mirrors the real shape where a session
// exists but the test didn't set one (keys fall back to the 'anon' seg).
let mockSession: { access_token: string; user?: { id: string } } | null = null
let mockFetch: ((url: string, init?: RequestInit) => Promise<Response>) | null = null

// Exposed so individual tests can inspect exactly which keys were written
// and seed legacy entries for the migration test.
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
  mockSession = null
  mockFetch = null
  // Stub global fetch so we can intercept the /api/sheet call.
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (mockFetch) return mockFetch(url, init)
    throw new Error('fetch not stubbed')
  }))
  // Stub localStorage so persistLocally doesn't error in node.
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: () => null,
    length: 0,
  })
  // Stub window so the localStorage check doesn't bail out.
  vi.stubGlobal('window', { localStorage })
})

describe('saveWorkbook', () => {
  it('falls back to localStorage when there is no session', async () => {
    const { saveWorkbook } = await import('@/lib/saveService')
    const result = await saveWorkbook({ name: 'Q1', data: { v: 1 } })
    expect(result.destination).toBe('localStorage')
    expect(result.fallbackReason).toBe('no session')
  })

  it('POSTs to /api/sheet when a session exists and returns the server id', async () => {
    mockSession = { access_token: SESSION_TOKEN }
    let calledUrl = ''
    let calledAuth = ''
    mockFetch = async (url, init) => {
      calledUrl = url
      calledAuth = String((init?.headers as Record<string, string>)['Authorization'])
      return new Response(JSON.stringify({ id: 'wb-from-server' }), { status: 200 })
    }
    const { saveWorkbook } = await import('@/lib/saveService')
    const result = await saveWorkbook({ name: 'Q1', data: { v: 1 } })
    expect(calledUrl).toBe('/api/sheet')
    expect(calledAuth).toBe(`Bearer ${SESSION_TOKEN}`)
    expect(result.destination).toBe('supabase')
    expect(result.id).toBe('wb-from-server')
  })

  it('falls back to localStorage when the server returns 403', async () => {
    mockSession = { access_token: SESSION_TOKEN }
    mockFetch = async () => new Response(JSON.stringify({ error: 'no' }), { status: 403, statusText: 'Forbidden' })
    const { saveWorkbook } = await import('@/lib/saveService')
    const result = await saveWorkbook({ id: 'wb1', name: 'Q1', data: { v: 1 } })
    expect(result.destination).toBe('localStorage')
    expect(result.fallbackReason).toContain('403')
  })

  it('falls back to localStorage on network error', async () => {
    mockSession = { access_token: SESSION_TOKEN }
    mockFetch = async () => { throw new Error('connection refused') }
    const { saveWorkbook } = await import('@/lib/saveService')
    const result = await saveWorkbook({ name: 'Q1', data: { v: 1 } })
    expect(result.destination).toBe('localStorage')
    expect(result.fallbackReason).toContain('connection refused')
  })
})

/**
 * Data-isolation: the localStorage fallback must be keyed by workbook
 * identity (and by user when available), never by bare name.
 */
describe('localStorage key scheme (data isolation)', () => {
  it('writes the new identity-scoped key (NOT the legacy name key) on fallback', async () => {
    // No session → anon segment, id-scoped key.
    const { saveWorkbook } = await import('@/lib/saveService')
    await saveWorkbook({ id: 'wb-123', name: 'Budget.xlsx', data: { v: 1 } })

    const keys = Object.keys(store)
    expect(keys).toContain('quiksheets_workbook:anon:id:wb-123')
    // The legacy bare-name key must NOT be written by the new code path.
    expect(keys).not.toContain(`${LEGACY_KEY_PREFIX}_Budget.xlsx`)
  })

  it('scopes the key by Supabase user id when a session carries one', async () => {
    // Session present but server returns 500 → falls back to localStorage,
    // and the user id from the session must scope the key.
    mockSession = { access_token: SESSION_TOKEN, user: { id: 'user-abc' } }
    mockFetch = async () => new Response('boom', { status: 500, statusText: 'Server Error' })

    const { saveWorkbook } = await import('@/lib/saveService')
    const result = await saveWorkbook({ id: 'wb-9', name: 'Sheet', data: { v: 1 } })

    expect(result.destination).toBe('localStorage')
    expect(Object.keys(store)).toContain('quiksheets_workbook:user-abc:id:wb-9')
  })

  it('uses a name slug when no workbook id is present', async () => {
    const { saveWorkbook } = await import('@/lib/saveService')
    await saveWorkbook({ name: 'My Budget 2026!', data: { v: 1 } })
    expect(Object.keys(store)).toContain('quiksheets_workbook:anon:name:my-budget-2026')
  })

  it('isolates two workbooks that share a name but have different ids', async () => {
    const { saveWorkbook } = await import('@/lib/saveService')
    await saveWorkbook({ id: 'wb-A', name: 'Budget.xlsx', data: { owner: 'alice' } })
    await saveWorkbook({ id: 'wb-B', name: 'Budget.xlsx', data: { owner: 'bob' } })

    const keyA = 'quiksheets_workbook:anon:id:wb-A'
    const keyB = 'quiksheets_workbook:anon:id:wb-B'
    expect(Object.keys(store)).toEqual(expect.arrayContaining([keyA, keyB]))

    // Critically, neither entry clobbered the other.
    expect(JSON.parse(store[keyA]!).data).toEqual({ owner: 'alice' })
    expect(JSON.parse(store[keyB]!).data).toEqual({ owner: 'bob' })
  })

  it('isolates same-name same-id workbooks across two different users', async () => {
    const { saveWorkbook } = await import('@/lib/saveService')

    // Both users fall back to localStorage on a 500; same workbook name+id.
    mockFetch = async () => new Response('x', { status: 500, statusText: 'err' })

    mockSession = { access_token: SESSION_TOKEN, user: { id: 'alice' } }
    await saveWorkbook({ id: 'shared', name: 'Budget.xlsx', data: { who: 'alice' } })

    mockSession = { access_token: SESSION_TOKEN, user: { id: 'bob' } }
    await saveWorkbook({ id: 'shared', name: 'Budget.xlsx', data: { who: 'bob' } })

    expect(JSON.parse(store['quiksheets_workbook:alice:id:shared']!).data).toEqual({ who: 'alice' })
    expect(JSON.parse(store['quiksheets_workbook:bob:id:shared']!).data).toEqual({ who: 'bob' })
  })
})

describe('loadWorkbook migration', () => {
  it('reads from the new name-scoped key when present', async () => {
    store['quiksheets_workbook:anon:name:q1'] = JSON.stringify({ name: 'Q1', data: { fresh: true } })
    const { loadWorkbook } = await import('@/lib/saveService')
    const loaded = await loadWorkbook('Q1')
    expect(loaded).not.toBeNull()
    expect(loaded!.data).toEqual({ fresh: true })
  })

  it('migrates a legacy name-based entry to the new key and returns it', async () => {
    // Seed ONLY the legacy key, as an older build would have written.
    store[`${LEGACY_KEY_PREFIX}_Q1`] = JSON.stringify({ name: 'Q1', data: { legacy: true } })

    const { loadWorkbook } = await import('@/lib/saveService')
    const loaded = await loadWorkbook('Q1')

    // Returned the legacy data...
    expect(loaded).not.toBeNull()
    expect(loaded!.data).toEqual({ legacy: true })
    // ...and re-homed it under the new key for the next fast read.
    expect(store['quiksheets_workbook:anon:name:q1']).toBeDefined()
    expect(JSON.parse(store['quiksheets_workbook:anon:name:q1']!).data).toEqual({ legacy: true })
  })

  it('prefers the new key over a stale legacy entry', async () => {
    store['quiksheets_workbook:anon:name:q1'] = JSON.stringify({ name: 'Q1', data: { fresh: true } })
    store[`${LEGACY_KEY_PREFIX}_Q1`] = JSON.stringify({ name: 'Q1', data: { stale: true } })

    const { loadWorkbook } = await import('@/lib/saveService')
    const loaded = await loadWorkbook('Q1')
    expect(loaded!.data).toEqual({ fresh: true })
  })

  it('returns null when neither key exists', async () => {
    const { loadWorkbook } = await import('@/lib/saveService')
    expect(await loadWorkbook('Nope')).toBeNull()
  })

  it('NEVER serves the legacy unscoped blob to an authenticated user (cross-user isolation)', async () => {
    // SECURITY contract (supersedes the old "migrate legacy for authed users"
    // behavior): the legacy `quiksheets_workbook_<name>` key has NO user
    // segment, so on a shared browser it may hold a DIFFERENT person's data.
    // Authenticated users must not hydrate it; only anon sessions may (their
    // own pre-isolation residue, migrated by the test above).
    mockSession = { access_token: SESSION_TOKEN, user: { id: 'user-xyz' } }
    store[`${LEGACY_KEY_PREFIX}_Q1`] = JSON.stringify({ name: 'Q1', data: { legacy: true } })

    const { loadWorkbook } = await import('@/lib/saveService')
    const loaded = await loadWorkbook('Q1')
    expect(loaded).toBeNull()
    expect(store['quiksheets_workbook:user-xyz:name:q1']).toBeUndefined()
  })
})

// The actual data-loss fix: edits saved by id must be loadable by id, and
// same-named workbooks must not clobber each other (the "all Untitled
// Workbook share one key" bug).
describe('id-keyed persistence round-trip', () => {
  it('saveWorkbook (no session) round-trips through loadWorkbookData by id', async () => {
    const { saveWorkbook, loadWorkbookData } = await import('@/lib/saveService')
    await saveWorkbook({ id: 'wb_123', name: 'Untitled Workbook', data: { cells: 'A' } })
    const loaded = await loadWorkbookData({ id: 'wb_123', name: 'Untitled Workbook' })
    expect(loaded?.data).toEqual({ cells: 'A' })
  })

  it('two same-named workbooks with different ids do NOT collide', async () => {
    const { saveWorkbook, loadWorkbookData } = await import('@/lib/saveService')
    await saveWorkbook({ id: 'wb_A', name: 'Untitled Workbook', data: { which: 'A' } })
    await saveWorkbook({ id: 'wb_B', name: 'Untitled Workbook', data: { which: 'B' } })
    expect((await loadWorkbookData({ id: 'wb_A', name: 'Untitled Workbook' }))?.data).toEqual({ which: 'A' })
    expect((await loadWorkbookData({ id: 'wb_B', name: 'Untitled Workbook' }))?.data).toEqual({ which: 'B' })
  })

  it('flushPendingSave persists the pending debounced payload immediately', async () => {
    const { debouncedSave, flushPendingSave, loadWorkbookData } = await import('@/lib/saveService')
    debouncedSave({ id: 'wb_flush', name: 'X', data: { flushed: true } })
    flushPendingSave()
    const loaded = await loadWorkbookData({ id: 'wb_flush', name: 'X' })
    expect(loaded?.data).toEqual({ flushed: true })
  })
})

// Optimistic concurrency: a stale save is rejected (409) instead of silently
// overwriting someone else's edit — and the user's work is never lost.
describe('save-conflict guard', () => {
  it('on a versionless 409 drops the stale base and retries unconditionally, then surfaces conflict + keeps data local', async () => {
    const { saveWorkbook, noteWorkbookVersion } = await import('@/lib/saveService')
    mockSession = { access_token: SESSION_TOKEN, user: { id: 'u1' } }
    noteWorkbookVersion('wbc1', '2026-01-01T00:00:00Z')

    const sentBases: (string | undefined)[] = []
    mockFetch = async (_url, init) => {
      sentBases.push(JSON.parse(String(init?.body)).baseUpdatedAt)
      // 409 with NO currentUpdatedAt — sheetApi legitimately sends `null` here.
      return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 })
    }

    const result = await saveWorkbook({ id: 'wbc1', name: 'X', data: { v: 1 } })
    // First attempt sends the noted base; after a versionless 409 it DROPS the
    // base and retries unconditionally so the client can't wedge forever on a
    // base it can never advance (the reported "Edited elsewhere" lock-up).
    expect(sentBases).toHaveLength(2)
    expect(sentBases[0]).toBe('2026-01-01T00:00:00Z')
    expect(sentBases[1]).toBeUndefined()
    // Retry also conflicted → surface conflict, keep work local (no loss).
    expect(result.conflict).toBe(true)
    expect(result.destination).toBe('localStorage')
    expect(store['quiksheets_workbook:u1:id:wbc1']).toBeDefined()
  })

  it('on a 409 WITH a server version, adopts it and the retry succeeds (self-heal)', async () => {
    const { saveWorkbook, noteWorkbookVersion } = await import('@/lib/saveService')
    mockSession = { access_token: SESSION_TOKEN, user: { id: 'u1' } }
    // Unique id so the module-global version map doesn't leak into other tests.
    noteWorkbookVersion('wbcHeal', '2026-01-01T00:00:00Z')

    const sentBases: (string | undefined)[] = []
    let calls = 0
    mockFetch = async (_url, init) => {
      sentBases.push(JSON.parse(String(init?.body)).baseUpdatedAt)
      calls += 1
      if (calls === 1) {
        return new Response(
          JSON.stringify({ error: 'conflict', currentUpdatedAt: '2026-02-02T00:00:00Z' }),
          { status: 409 },
        )
      }
      return new Response(JSON.stringify({ id: 'wbcHeal', updatedAt: '2026-02-02T00:00:01Z' }), {
        status: 200,
      })
    }

    const result = await saveWorkbook({ id: 'wbcHeal', name: 'X', data: { v: 2 } })
    expect(sentBases[0]).toBe('2026-01-01T00:00:00Z') // stale first attempt
    expect(sentBases[1]).toBe('2026-02-02T00:00:00Z') // adopted server version on retry
    expect(result.destination).toBe('supabase')
    expect(result.conflict).toBeUndefined()
  })

  it('records the returned updatedAt so the NEXT save sends it as the base', async () => {
    const { saveWorkbook } = await import('@/lib/saveService')
    mockSession = { access_token: SESSION_TOKEN, user: { id: 'u1' } }

    let calls = 0
    const bases: (string | undefined)[] = []
    mockFetch = async (_url, init) => {
      bases.push(JSON.parse(String(init?.body)).baseUpdatedAt)
      calls += 1
      return new Response(JSON.stringify({ id: 'wbc2', updatedAt: `T${calls}` }), { status: 200 })
    }

    await saveWorkbook({ id: 'wbc2', name: 'X', data: {} }) // no base yet
    await saveWorkbook({ id: 'wbc2', name: 'X', data: {} }) // base = T1 (from 1st response)
    expect(bases[0]).toBeUndefined()
    expect(bases[1]).toBe('T1')
  })
})
