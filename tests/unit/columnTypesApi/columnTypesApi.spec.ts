/**
 * Contract tests for src/lib/columnTypesApi.ts.
 *
 * Mirrors the pattern of tests/unit/commentsApi/commentsApi.spec.ts.
 *
 * Branches covered:
 *   1. No Supabase client → localStorage path
 *   2. No session → localStorage path
 *   3. Session + 200 OK from Supabase → records returned from DB shape
 *   4. Session + RLS/network error on select → localStorage fallback
 *   5. setColumnType: writes localStorage immediately AND calls Supabase
 *   6. clearColumnType: removes from localStorage AND calls Supabase
 *   7. One-time per-workbook migration runs on first signed-in load
 *   8. Migration does NOT clear local when upsert fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const WORKBOOK = 'wb-col-test-uuid'
const USER_ID = 'user-col-test-uuid'

// ─── Mock shape ──────────────────────────────────────────────────────────────

interface MockUser {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
}

let mockUser: MockUser | null = null
let mockSelectResponse: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
}
let mockUpsertResponse: { error: { message: string } | null } = { error: null }
let mockDeleteResponse: { error: { message: string } | null } = { error: null }
let mockClientPresent = true

const upsertSpy = vi.fn()
const deleteSpy = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => {
    if (!mockClientPresent) return null
    return {
      auth: {
        getUser: async () => ({ data: { user: mockUser } }),
      },
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_col: string, _val: string) => mockSelectResponse,
        }),
        upsert: (payload: unknown, _opts?: unknown) => {
          upsertSpy(payload)
          return Promise.resolve(mockUpsertResponse)
        },
        delete: () => {
          deleteSpy()
          return {
            eq: (_c1: string, _v1: string) => ({
              eq: (_c2: string, _v2: string) => ({
                eq: async (_c3: string, _v3: unknown) => mockDeleteResponse,
              }),
            }),
          }
        },
      }),
    }
  },
}))

// ─── localStorage shim ───────────────────────────────────────────────────────

function makeLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: () => null,
    length: 0,
    _store: store,
  }
}

let ls = makeLocalStorage()

beforeEach(() => {
  vi.resetModules()
  mockUser = null
  mockSelectResponse = { data: [], error: null }
  mockUpsertResponse = { error: null }
  mockDeleteResponse = { error: null }
  mockClientPresent = true
  upsertSpy.mockClear()
  deleteSpy.mockClear()
  ls = makeLocalStorage()
  vi.stubGlobal('localStorage', ls)
  vi.stubGlobal('window', { localStorage: ls })
})

// ─── loadColumnTypes ─────────────────────────────────────────────────────────

describe('loadColumnTypes', () => {
  it('returns localStorage data when Supabase client is absent', async () => {
    mockClientPresent = false
    // Seed local data.
    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '2': { type: 'currency', currencySymbol: '₹' } },
    }))
    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    const result = await loadColumnTypes(WORKBOOK)
    expect(result).toEqual({ sheet1: { '2': { type: 'currency', currencySymbol: '₹' } } })
  })

  it('returns localStorage data when there is no signed-in user', async () => {
    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '0': { type: 'checkbox' } },
    }))
    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    const result = await loadColumnTypes(WORKBOOK)
    expect(result).toEqual({ sheet1: { '0': { type: 'checkbox' } } })
  })

  it('returns DB rows mapped to WorkbookColumnMap when a session is present', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    // Pin migration flag so we don't invoke upsert during migration.
    ls.setItem(`quiksheets_col_types_migrated_to_supabase:${WORKBOOK}`, 'true')
    mockSelectResponse = {
      data: [
        {
          id: 'row1',
          workbook_id: WORKBOOK,
          sheet_id: 'sheet1',
          column_index: 3,
          type: 'date',
          config: { dateFormat: 'short' },
          created_at: '2026-05-20T10:00:00Z',
          updated_at: '2026-05-20T10:00:00Z',
        },
        {
          id: 'row2',
          workbook_id: WORKBOOK,
          sheet_id: 'sheet2',
          column_index: 0,
          type: 'select',
          config: { options: ['Lead', 'Customer'] },
          created_at: '2026-05-20T10:00:00Z',
          updated_at: '2026-05-20T10:00:00Z',
        },
      ],
      error: null,
    }
    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    const result = await loadColumnTypes(WORKBOOK)
    expect(result).toEqual({
      sheet1: { '3': { type: 'date', dateFormat: 'short' } },
      sheet2: { '0': { type: 'select', options: ['Lead', 'Customer'] } },
    })
    expect(upsertSpy).not.toHaveBeenCalled() // migration already flagged
  })

  it('falls back to localStorage when the Supabase select errors', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    ls.setItem(`quiksheets_col_types_migrated_to_supabase:${WORKBOOK}`, 'true')
    mockSelectResponse = { data: null, error: { message: 'rls denied' } }
    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '1': { type: 'number' } },
    }))
    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    const result = await loadColumnTypes(WORKBOOK)
    expect(result).toEqual({ sheet1: { '1': { type: 'number' } } })
  })
})

// ─── setColumnType ────────────────────────────────────────────────────────────

describe('setColumnType', () => {
  it('writes to localStorage immediately even without a session', async () => {
    const { setColumnType } = await import('@/lib/columnTypesApi')
    await setColumnType(WORKBOOK, 'sheet1', 2, { type: 'currency' })
    const stored = JSON.parse(ls.getItem(`quiksheets_column_types:${WORKBOOK}`) ?? '{}') as Record<string, unknown>
    expect(stored).toMatchObject({ sheet1: { '2': { type: 'currency' } } })
    expect(upsertSpy).not.toHaveBeenCalled() // no session
  })

  it('calls Supabase upsert when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const { setColumnType } = await import('@/lib/columnTypesApi')
    await setColumnType(WORKBOOK, 'sheet1', 5, { type: 'status', options: ['Active', 'Done'] })
    expect(upsertSpy).toHaveBeenCalledOnce()
    const payload = upsertSpy.mock.calls[0]?.[0] as {
      workbook_id: string
      sheet_id: string
      column_index: number
      type: string
      config: { options: string[] }
    }
    expect(payload.workbook_id).toBe(WORKBOOK)
    expect(payload.sheet_id).toBe('sheet1')
    expect(payload.column_index).toBe(5)
    expect(payload.type).toBe('status')
    expect(payload.config.options).toEqual(['Active', 'Done'])
  })
})

// ─── clearColumnType ──────────────────────────────────────────────────────────

describe('clearColumnType', () => {
  it('removes entry from localStorage immediately', async () => {
    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '2': { type: 'currency' }, '5': { type: 'number' } },
    }))
    const { clearColumnType } = await import('@/lib/columnTypesApi')
    await clearColumnType(WORKBOOK, 'sheet1', 2)
    const stored = JSON.parse(ls.getItem(`quiksheets_column_types:${WORKBOOK}`) ?? '{}') as Record<string, Record<string, unknown>>
    expect(stored['sheet1']?.['2']).toBeUndefined()
    expect(stored['sheet1']?.['5']).toEqual({ type: 'number' }) // untouched
  })

  it('calls Supabase delete when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const { clearColumnType } = await import('@/lib/columnTypesApi')
    await clearColumnType(WORKBOOK, 'sheet1', 3)
    expect(deleteSpy).toHaveBeenCalledOnce()
  })

  it('does not crash when localStorage has no entry for the column', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const { clearColumnType } = await import('@/lib/columnTypesApi')
    // Should not throw even if the column was never typed.
    await expect(clearColumnType(WORKBOOK, 'sheet1', 99)).resolves.toBeUndefined()
  })
})

// ─── one-time localStorage → Supabase migration ───────────────────────────────

describe('one-time localStorage → Supabase migration', () => {
  it('uploads existing local types and sets the migration flag + clears local', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockUpsertResponse = { error: null }

    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '0': { type: 'checkbox' }, '2': { type: 'number' } },
      sheet2: { '1': { type: 'date', dateFormat: 'iso' } },
    }))

    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    await loadColumnTypes(WORKBOOK)

    expect(upsertSpy).toHaveBeenCalledOnce()
    const payload = upsertSpy.mock.calls[0]?.[0] as Array<{
      workbook_id: string
      sheet_id: string
      column_index: number
      type: string
    }>
    expect(payload).toHaveLength(3)
    const types = payload.map((r) => r.type).sort()
    expect(types).toEqual(['checkbox', 'date', 'number'])

    // Flag set + local cleared.
    expect(ls.getItem(`quiksheets_col_types_migrated_to_supabase:${WORKBOOK}`)).toBe('true')
    expect(ls.getItem(`quiksheets_column_types:${WORKBOOK}`)).toBeNull()
  })

  it('does NOT set the flag or clear local when upsert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockUpsertResponse = { error: { message: 'rls denied' } }

    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '0': { type: 'text' } },
    }))

    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    await loadColumnTypes(WORKBOOK)

    expect(ls.getItem(`quiksheets_col_types_migrated_to_supabase:${WORKBOOK}`)).toBeNull()
    expect(ls.getItem(`quiksheets_column_types:${WORKBOOK}`)).not.toBeNull()
  })

  it('skips upsert when local map is empty and sets the flag immediately', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    // No local data.

    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    await loadColumnTypes(WORKBOOK)

    expect(upsertSpy).not.toHaveBeenCalled()
    expect(ls.getItem(`quiksheets_col_types_migrated_to_supabase:${WORKBOOK}`)).toBe('true')
  })

  it('is a no-op on subsequent calls when the migration flag is set', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    ls.setItem(`quiksheets_col_types_migrated_to_supabase:${WORKBOOK}`, 'true')
    ls.setItem(`quiksheets_column_types:${WORKBOOK}`, JSON.stringify({
      sheet1: { '0': { type: 'checkbox' } },
    }))

    const { loadColumnTypes } = await import('@/lib/columnTypesApi')
    await loadColumnTypes(WORKBOOK)
    await loadColumnTypes(WORKBOOK) // second call

    // upsertSpy called 0 times — migration already flagged.
    expect(upsertSpy).not.toHaveBeenCalled()
  })
})
