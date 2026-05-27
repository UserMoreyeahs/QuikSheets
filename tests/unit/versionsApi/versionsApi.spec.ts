/**
 * Contract tests for src/lib/versionsApi.ts.
 *
 * Pins the Supabase-with-fallback behaviour so the version-history feature
 * can never silently regress to localStorage-only (the pattern that broke
 * T012 saveService before the MVP pass).
 *
 * Branches covered:
 *   1. No Supabase client → localStorage path for list / snapshot / restore
 *   2. No session → localStorage path
 *   3. Session + 200 OK → Supabase path; returns VersionRecord[]
 *   4. Session + Supabase error → localStorage fallback
 *   5. snapshotVersion writes to Supabase when signed in
 *   6. snapshotVersion falls back to localStorage on insert error
 *   7. restoreVersion creates a safety pre-restore snapshot, then returns sheets
 *   8. restoreVersion returns null when the version is not found
 *   9. One-time per-workbook migration runs on first signed-in load
 *  10. deleteVersion routes to Supabase when signed in
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Sheet } from '@fortune-sheet/core'

const WORKBOOK = 'wb-test-uuid'
const USER_ID = 'user-test-uuid'

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

interface MockUser {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
}

let mockUser: MockUser | null = null
let mockClientPresent = true

/** What `from('workbook_versions').select(...).eq(...).eq(...).order(...).limit()` resolves to */
let mockSelectResponse: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
}
/** What the single-row maybeSingle() path returns (used by restoreVersion) */
let mockMaybeSingleResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}
/** What insert().select().single() returns */
let mockInsertSingleResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}
/** What bare insert (no select chain) returns */
let mockBareInsertResponse: { error: { message: string } | null } = { error: null }
/** What delete().eq().eq() returns */
let mockDeleteResponse: { error: { message: string } | null } = { error: null }

const insertSpy = vi.fn()
const updateSpy = vi.fn()
const deleteSpy = vi.fn()

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/client
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => {
    if (!mockClientPresent) return null
    return {
      auth: {
        getUser: async () => ({ data: { user: mockUser } }),
      },
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_c: string, _v: string) => ({
            eq: (_c2: string, _v2: string) => ({
              maybeSingle: async () => mockMaybeSingleResponse,
              order: (_col: string, _opts: unknown) => ({
                limit: (_n: number) => mockSelectResponse,
              }),
            }),
            order: (_col: string, _opts: unknown) => ({
              limit: (_n: number) => mockSelectResponse,
            }),
          }),
        }),
        insert: (payload: unknown) => {
          insertSpy(payload)
          return {
            // insert().select().single() used by snapshotVersion
            select: (_cols: string) => ({
              single: async () => mockInsertSingleResponse,
            }),
            // bare insert().then() used by migration
            then: (resolve: (v: typeof mockBareInsertResponse) => void) => {
              resolve(mockBareInsertResponse)
            },
          }
        },
        update: (payload: unknown) => {
          updateSpy(payload)
          return {
            eq: (_c: string, _v: string) => ({
              eq: async (_c2: string, _v2: string) => ({ error: null }),
            }),
          }
        },
        delete: () => {
          deleteSpy()
          return {
            eq: (_c: string, _v: string) => ({
              eq: async (_c2: string, _v2: string) => mockDeleteResponse,
            }),
          }
        },
      }),
    }
  },
}))

// ---------------------------------------------------------------------------
// Mock @/lib/fortuneSheet so cloneSheets doesn't need the full lib
// ---------------------------------------------------------------------------

vi.mock('@/lib/fortuneSheet', () => ({
  cloneSheetWithData: (s: Sheet) => ({ ...s }),
  getSheetMatrix: () => [],
}))

// ---------------------------------------------------------------------------
// localStorage shim
// ---------------------------------------------------------------------------

let _store: Record<string, string> = {}

function makeLocalStorage() {
  return {
    getItem: (k: string) => _store[k] ?? null,
    setItem: (k: string, v: string) => {
      _store[k] = v
    },
    removeItem: (k: string) => {
      delete _store[k]
    },
    clear: () => {
      _store = {}
    },
    key: () => null,
    length: 0,
  }
}

// ---------------------------------------------------------------------------
// Helper: a minimal Sheet[]
// ---------------------------------------------------------------------------

function makeSheets(id = 'sheet1'): Sheet[] {
  return [{ id, name: 'Sheet1', status: 1, hide: 0, order: 0 }] as unknown as Sheet[]
}

// ---------------------------------------------------------------------------
// Reset before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules()
  _store = {}
  mockUser = null
  mockClientPresent = true
  mockSelectResponse = { data: [], error: null }
  mockMaybeSingleResponse = { data: null, error: null }
  mockInsertSingleResponse = { data: null, error: null }
  mockBareInsertResponse = { error: null }
  mockDeleteResponse = { error: null }
  insertSpy.mockClear()
  updateSpy.mockClear()
  deleteSpy.mockClear()
  vi.stubGlobal('localStorage', makeLocalStorage())
  vi.stubGlobal('window', { localStorage })
})

// ---------------------------------------------------------------------------
// listVersions
// ---------------------------------------------------------------------------

describe('listVersions', () => {
  it('falls back to localStorage when Supabase client is absent', async () => {
    mockClientPresent = false
    const { listVersions } = await import('@/lib/versionsApi')
    const result = await listVersions(WORKBOOK)
    // localStorage is empty → empty list
    expect(result).toEqual([])
  })

  it('falls back to localStorage when there is no signed-in user', async () => {
    // Seed a local snapshot via localVersionStore
    const { snapshotWorkbook } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    snapshotWorkbook(WORKBOOK, makeSheets(), 'local snap')

    const { listVersions } = await import('@/lib/versionsApi')
    const result = await listVersions(WORKBOOK)
    expect(result).toHaveLength(1)
    expect(result[0]?.label).toBe('local snap')
    expect(result[0]?.source).toBe('local')
  })

  it('returns DB rows mapped to VersionRecord when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = {
      data: [
        {
          id: 'v1',
          workbook_id: WORKBOOK,
          label: 'Remote snap',
          created_by: USER_ID,
          created_at: '2026-05-20T10:00:00Z',
        },
      ],
      error: null,
    }
    const { listVersions } = await import('@/lib/versionsApi')
    const result = await listVersions(WORKBOOK)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'v1',
      label: 'Remote snap',
      source: 'remote',
    })
  })

  it('falls back to localStorage when Supabase select errors', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: null, error: { message: 'rls denied' } }
    // Pin migration flag so the local cache isn't drained on this read.
    window.localStorage.setItem(`quiksheets_versions_migrated_to_supabase:${WORKBOOK}`, 'true')
    const { snapshotWorkbook } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    snapshotWorkbook(WORKBOOK, makeSheets(), 'cached')

    const { listVersions } = await import('@/lib/versionsApi')
    const result = await listVersions(WORKBOOK)
    expect(result).toHaveLength(1)
    expect(result[0]?.label).toBe('cached')
    expect(result[0]?.source).toBe('local')
  })
})

// ---------------------------------------------------------------------------
// snapshotVersion
// ---------------------------------------------------------------------------

describe('snapshotVersion', () => {
  it('writes to Supabase when signed in and returns a remote VersionRecord', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockInsertSingleResponse = {
      data: {
        id: 'new-v',
        workbook_id: WORKBOOK,
        label: 'Test snap',
        created_by: USER_ID,
        created_at: '2026-05-20T11:00:00Z',
      },
      error: null,
    }
    const { snapshotVersion } = await import('@/lib/versionsApi')
    const result = await snapshotVersion(WORKBOOK, makeSheets(), 'Test snap')
    expect(insertSpy).toHaveBeenCalledOnce()
    const payload = insertSpy.mock.calls[0]?.[0] as {
      workbook_id: string
      label: string
      snapshot: { sheets: unknown[] }
    }
    expect(payload.workbook_id).toBe(WORKBOOK)
    expect(payload.label).toBe('Test snap')
    expect(Array.isArray(payload.snapshot.sheets)).toBe(true)
    expect(result.id).toBe('new-v')
    expect(result.source).toBe('remote')
  })

  it('falls back to localStorage when Supabase insert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockInsertSingleResponse = { data: null, error: { message: 'insert error' } }
    const { snapshotVersion } = await import('@/lib/versionsApi')
    const result = await snapshotVersion(WORKBOOK, makeSheets(), 'fallback')
    expect(result.source).toBe('local')
    expect(result.label).toBe('fallback')
    // Verify it was written to localStorage
    const { listWorkbookVersions } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    expect(listWorkbookVersions(WORKBOOK)).toHaveLength(1)
  })

  it('writes to localStorage when there is no session', async () => {
    const { snapshotVersion } = await import('@/lib/versionsApi')
    const result = await snapshotVersion(WORKBOOK, makeSheets(), 'offline')
    expect(result.source).toBe('local')
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// restoreVersion
// ---------------------------------------------------------------------------

describe('restoreVersion', () => {
  it('creates a pre-restore safety snapshot, then returns the target sheets', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const targetSheets = makeSheets('target')
    // The pre-restore snapshot insert succeeds.
    mockInsertSingleResponse = {
      data: {
        id: 'pre-restore',
        workbook_id: WORKBOOK,
        label: 'Auto-saved before restore',
        created_by: USER_ID,
        created_at: '2026-05-20T12:00:00Z',
      },
      error: null,
    }
    // The target version fetch returns a snapshot.
    mockMaybeSingleResponse = {
      data: { snapshot: { sheets: targetSheets } },
      error: null,
    }
    const { restoreVersion } = await import('@/lib/versionsApi')
    const sheets = await restoreVersion(WORKBOOK, 'v-target', makeSheets('current'))
    // Should have called insert at least once (safety snapshot).
    expect(insertSpy).toHaveBeenCalled()
    expect(sheets).not.toBeNull()
    expect(sheets).toHaveLength(1)
    expect(sheets![0]?.id).toBe('target')
  })

  it('returns null when the target version is not found', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    // Safety snapshot succeeds.
    mockInsertSingleResponse = {
      data: {
        id: 'pre-restore',
        workbook_id: WORKBOOK,
        label: 'Auto-saved before restore',
        created_by: USER_ID,
        created_at: '2026-05-20T12:00:00Z',
      },
      error: null,
    }
    // Target not found.
    mockMaybeSingleResponse = { data: null, error: null }
    const { restoreVersion } = await import('@/lib/versionsApi')
    const result = await restoreVersion(WORKBOOK, 'missing-id', makeSheets())
    expect(result).toBeNull()
  })

  it('restores from localStorage when there is no session', async () => {
    // Seed a local snapshot.
    const { snapshotWorkbook, listWorkbookVersions } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    const targetSheets = makeSheets('local-target')
    snapshotWorkbook(WORKBOOK, targetSheets, 'local version')
    const stored = listWorkbookVersions(WORKBOOK)
    expect(stored).toHaveLength(1)
    const versionId = stored[0]!.id

    const { restoreVersion } = await import('@/lib/versionsApi')
    const result = await restoreVersion(WORKBOOK, versionId, makeSheets('current'))
    // Should have two local snapshots now: safety + original.
    const all = listWorkbookVersions(WORKBOOK)
    expect(all.length).toBeGreaterThanOrEqual(2)
    expect(result).not.toBeNull()
    expect(result![0]?.id).toBe('local-target')
  })
})

// ---------------------------------------------------------------------------
// One-time migration: localStorage → Supabase
// ---------------------------------------------------------------------------

describe('one-time localStorage → Supabase migration', () => {
  it('uploads existing local snapshots and sets the migrated flag', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockBareInsertResponse = { error: null }

    const { snapshotWorkbook } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    snapshotWorkbook(WORKBOOK, makeSheets(), 'first')
    snapshotWorkbook(WORKBOOK, makeSheets(), 'second')

    const { listVersions } = await import('@/lib/versionsApi')
    await listVersions(WORKBOOK)

    expect(insertSpy).toHaveBeenCalledOnce()
    const payload = insertSpy.mock.calls[0]?.[0] as Array<{ label: string }>
    expect(payload).toHaveLength(2)

    expect(
      window.localStorage.getItem(
        `quiksheets_versions_migrated_to_supabase:${WORKBOOK}`
      )
    ).toBe('true')
  })

  it('does NOT set the migrated flag when the insert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockBareInsertResponse = { error: { message: 'rls denied' } }

    const { snapshotWorkbook } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    snapshotWorkbook(WORKBOOK, makeSheets(), 'keep me')

    const { listVersions } = await import('@/lib/versionsApi')
    await listVersions(WORKBOOK)

    expect(
      window.localStorage.getItem(
        `quiksheets_versions_migrated_to_supabase:${WORKBOOK}`
      )
    ).toBeNull()

    // Local snapshot should still be present.
    const { listWorkbookVersions } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    expect(listWorkbookVersions(WORKBOOK)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// deleteVersion
// ---------------------------------------------------------------------------

describe('deleteVersion', () => {
  it('routes to Supabase when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const { deleteVersion } = await import('@/lib/versionsApi')
    await deleteVersion(WORKBOOK, 'v1')
    expect(deleteSpy).toHaveBeenCalledOnce()
  })

  it('falls back to local delete when there is no session', async () => {
    const { snapshotWorkbook, listWorkbookVersions } = await import(
      '@/features/version-history/storage/localVersionStore'
    )
    snapshotWorkbook(WORKBOOK, makeSheets(), 'to delete')
    const stored = listWorkbookVersions(WORKBOOK)
    const vId = stored[0]!.id

    const { deleteVersion } = await import('@/lib/versionsApi')
    await deleteVersion(WORKBOOK, vId)

    expect(listWorkbookVersions(WORKBOOK)).toHaveLength(0)
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
