/**
 * Contract tests for src/lib/commentsApi.ts.
 *
 * Pins the Supabase-with-fallback behaviour so the comments feature can
 * never silently regress to localStorage-only the way saveService did
 * before MVP T012.
 *
 * Branches covered:
 *   1. No Supabase client → localStorage path
 *   2. No session → localStorage path
 *   3. Session + 200 OK from Supabase → records returned from DB shape
 *   4. Session + RLS/network error → localStorage path
 *   5. Mutations (create/resolve/delete) route to Supabase when signed in
 *   6. One-time per-workbook migration runs on first signed-in load
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const WORKBOOK = 'wb-test-uuid'
const USER_ID = 'user-test-uuid'

interface MockUser {
  id: string
  email: string | null
  user_metadata: Record<string, unknown>
}

let mockUser: MockUser | null = null
let mockSelectResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}
let mockInsertResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}
let mockDeleteResponse: { error: { message: string } | null } = { error: null }
let mockUpdateResponse: { error: { message: string } | null } = { error: null }
let mockClientPresent = true

const insertSpy = vi.fn()
const updateSpy = vi.fn()
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
          eq: (_col: string, _val: string) => ({
            order: () => mockSelectResponse,
          }),
        }),
        insert: (payload: unknown) => {
          insertSpy(payload)
          return {
            select: () => ({
              single: async () => mockInsertResponse,
            }),
            // bare insert for migration (no select chain)
            then: (resolve: (v: { error: { message: string } | null }) => void) => {
              resolve({ error: mockInsertResponse.error })
            },
          }
        },
        update: (payload: unknown) => {
          updateSpy(payload)
          return {
            eq: async (_col: string, _val: string) => mockUpdateResponse,
          }
        },
        delete: () => {
          deleteSpy()
          return {
            eq: async (_col: string, _val: string) => mockDeleteResponse,
          }
        },
      }),
    }
  },
}))

beforeEach(() => {
  vi.resetModules()
  mockUser = null
  mockSelectResponse = { data: [], error: null }
  mockInsertResponse = { data: null, error: null }
  mockDeleteResponse = { error: null }
  mockUpdateResponse = { error: null }
  mockClientPresent = true
  insertSpy.mockClear()
  updateSpy.mockClear()
  deleteSpy.mockClear()

  // localStorage / window shim — vitest jsdom envs already ship this,
  // but we reset the store on every test for isolation.
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
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
    key: () => null,
    length: 0,
  })
  vi.stubGlobal('window', { localStorage })
})

describe('loadComments', () => {
  it('falls back to localStorage when Supabase client is absent', async () => {
    mockClientPresent = false
    const { loadComments } = await import('@/lib/commentsApi')
    const result = await loadComments(WORKBOOK)
    expect(result).toEqual([])
  })

  it('falls back to localStorage when there is no signed-in user', async () => {
    // Seed a local comment so we can prove the fallback is hit.
    const { addComment } = await import('@/features/comments/storage/localCommentsStore')
    addComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'A1',
      body: 'local hello',
      author: 'You',
    })
    const { loadComments } = await import('@/lib/commentsApi')
    const result = await loadComments(WORKBOOK)
    expect(result).toHaveLength(1)
    expect(result[0]?.body).toBe('local hello')
  })

  it('returns DB rows mapped to CommentRecord when a session is present', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: { display_name: 'Vinay' } }
    mockSelectResponse = {
      data: [
        {
          id: 'c1',
          workbook_id: WORKBOOK,
          sheet_id: 'sheet1',
          cell_address: 'B3',
          body: 'remote hi',
          author_id: USER_ID,
          author_display_name: 'Vinay',
          mentions: ['priya'],
          parent_id: null,
          resolved: false,
          created_at: '2026-05-20T10:00:00Z',
          updated_at: '2026-05-20T10:00:00Z',
        },
      ],
      error: null,
    }
    const { loadComments } = await import('@/lib/commentsApi')
    const result = await loadComments(WORKBOOK)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'c1',
      sheetId: 'sheet1',
      cellAddress: 'B3',
      body: 'remote hi',
      author: 'Vinay',
      mentions: ['priya'],
      resolved: false,
      parentId: null,
    })
  })

  it('falls back to localStorage when the Supabase select errors', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: null, error: { message: 'rls denied' } }
    // Pin the migration flag so the local cache isn't drained on this load.
    // (Migration is tested separately below.)
    window.localStorage.setItem(`quiksheets_comments_migrated_to_supabase:${WORKBOOK}`, 'true')
    const { addComment } = await import('@/features/comments/storage/localCommentsStore')
    addComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'A1',
      body: 'cached',
      author: 'You',
    })
    const { loadComments } = await import('@/lib/commentsApi')
    const result = await loadComments(WORKBOOK)
    expect(result).toHaveLength(1)
    expect(result[0]?.body).toBe('cached')
  })
})

describe('createComment', () => {
  it('routes to Supabase when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: { display_name: 'Vinay' } }
    mockInsertResponse = {
      data: {
        id: 'new1',
        workbook_id: WORKBOOK,
        sheet_id: 'sheet1',
        cell_address: 'C5',
        body: 'hi @priya',
        author_id: USER_ID,
        author_display_name: 'Vinay',
        mentions: ['priya'],
        parent_id: null,
        resolved: false,
        created_at: '2026-05-20T11:00:00Z',
        updated_at: '2026-05-20T11:00:00Z',
      },
      error: null,
    }
    const { createComment } = await import('@/lib/commentsApi')
    const result = await createComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'C5',
      body: 'hi @priya',
    })
    expect(insertSpy).toHaveBeenCalledOnce()
    const payload = insertSpy.mock.calls[0]?.[0] as { author_id: string; mentions: string[]; body: string }
    expect(payload.author_id).toBe(USER_ID)
    expect(payload.mentions).toEqual(['priya'])
    expect(payload.body).toBe('hi @priya')
    expect(result.id).toBe('new1')
    expect(result.author).toBe('Vinay')
  })

  it('falls back to localStorage when Supabase insert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockInsertResponse = { data: null, error: { message: 'rls denied' } }
    const { createComment } = await import('@/lib/commentsApi')
    const result = await createComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'C5',
      body: 'oops',
    })
    expect(result.body).toBe('oops')
    // localStorage write happened — verify by reading via the local store.
    const { listComments } = await import('@/features/comments/storage/localCommentsStore')
    expect(listComments(WORKBOOK)).toHaveLength(1)
  })

  it('writes to localStorage when there is no session', async () => {
    const { createComment } = await import('@/lib/commentsApi')
    const result = await createComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'C5',
      body: 'offline',
    })
    expect(result.body).toBe('offline')
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('one-time localStorage → Supabase migration', () => {
  it('uploads existing local comments and clears the local cache + sets the flag', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: { display_name: 'Vinay' } }
    mockSelectResponse = { data: [], error: null }
    mockInsertResponse = { data: null, error: null }

    const { addComment } = await import('@/features/comments/storage/localCommentsStore')
    addComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'A1',
      body: 'first',
      author: 'You',
    })
    addComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'A2',
      body: 'second',
      author: 'You',
    })

    const { loadComments } = await import('@/lib/commentsApi')
    await loadComments(WORKBOOK)

    expect(insertSpy).toHaveBeenCalledOnce()
    const payload = insertSpy.mock.calls[0]?.[0] as Array<{ body: string; author_id: string }>
    expect(payload).toHaveLength(2)
    expect(payload[0]?.author_id).toBe(USER_ID)
    expect(payload.map((p) => p.body)).toEqual(['first', 'second'])

    // Flag is set + local cache cleared so the next call is a no-op.
    expect(
      window.localStorage.getItem(`quiksheets_comments_migrated_to_supabase:${WORKBOOK}`)
    ).toBe('true')
    expect(window.localStorage.getItem(`quiksheets_comments:${WORKBOOK}`)).toBeNull()
  })

  it('does NOT clear the local cache when the insert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockInsertResponse = { data: null, error: { message: 'rls denied' } }

    const { addComment } = await import('@/features/comments/storage/localCommentsStore')
    addComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'A1',
      body: 'keepme',
      author: 'You',
    })
    const { loadComments } = await import('@/lib/commentsApi')
    await loadComments(WORKBOOK)

    expect(
      window.localStorage.getItem(`quiksheets_comments_migrated_to_supabase:${WORKBOOK}`)
    ).toBeNull()
    const { listComments } = await import('@/features/comments/storage/localCommentsStore')
    expect(listComments(WORKBOOK)).toHaveLength(1)
  })
})

describe('resolveComment / deleteComment', () => {
  it('resolve routes to Supabase when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const { resolveComment } = await import('@/lib/commentsApi')
    await resolveComment(WORKBOOK, 'c1', true)
    expect(updateSpy).toHaveBeenCalledWith({ resolved: true })
  })

  it('delete routes to Supabase when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const { deleteComment } = await import('@/lib/commentsApi')
    await deleteComment(WORKBOOK, 'c1')
    expect(deleteSpy).toHaveBeenCalledOnce()
  })

  it('delete falls back to local when offline', async () => {
    const { addComment } = await import('@/features/comments/storage/localCommentsStore')
    const c = addComment({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      cellAddress: 'A1',
      body: 'gone',
      author: 'You',
    })
    const { deleteComment } = await import('@/lib/commentsApi')
    await deleteComment(WORKBOOK, c.id)
    const { listComments } = await import('@/features/comments/storage/localCommentsStore')
    expect(listComments(WORKBOOK)).toHaveLength(0)
  })
})
