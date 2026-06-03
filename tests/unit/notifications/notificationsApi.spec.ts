/**
 * Unit tests for src/lib/notificationsApi.ts
 *
 * Covers:
 *   1. resolveMentionsToUserIds — maps @handle → user_id via workbook_members+profiles
 *   2. insertMentionNotifications — inserts one row per resolved mention
 *   3. loadNotifications — maps DB rows / returns [] when no session
 *   4. markRead / markAllRead — route to Supabase when signed in
 *   5. unreadCount — returns count / 0 on error or no session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

const USER_ID = 'actor-uuid'
const WORKBOOK = 'wb-uuid'
const COMMENT_ID = 'comment-uuid'

let mockUser: { id: string } | null = null
let mockClientPresent = true

// Per-table mock responses — keyed by table name.
const mockSelectData: Record<string, unknown[] | null> = {}
const mockSelectError: Record<string, { message: string } | null> = {}
let mockInsertError: { message: string } | null = null
let mockUpdateError: { message: string } | null = null
let mockCountValue: number | null = 0

const insertSpy = vi.fn()
const updateSpy = vi.fn()
const selectSpy = vi.fn()

// ---------------------------------------------------------------------------
// Supabase client mock
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => {
    if (!mockClientPresent) return null
    return {
      auth: {
        getUser: async () => ({ data: { user: mockUser } }),
      },
      from: (table: string) => ({
        select: (cols: string, opts?: { count?: string; head?: boolean }) => {
          selectSpy(table, cols)
          // Head request (for count)
          if (opts?.head) {
            return {
              eq: (_: string, __: unknown) => ({
                eq: (_2: string, __2: unknown) =>
                  Promise.resolve({ count: mockCountValue, error: mockSelectError[table] ?? null }),
              }),
            }
          }
          return {
            eq: (_col: string, _val: unknown) => ({
              order: (_ord: string, _dir: unknown) => ({
                limit: (_n: number) =>
                  Promise.resolve({
                    data: mockSelectData[table] ?? [],
                    error: mockSelectError[table] ?? null,
                  }),
              }),
              // workbook_members has no .order() → returns directly from .eq()
              limit: (_n: number) =>
                Promise.resolve({
                  data: mockSelectData[table] ?? [],
                  error: mockSelectError[table] ?? null,
                }),
            }),
          }
        },
        insert: (rows: unknown) => {
          insertSpy(rows)
          return Promise.resolve({ error: mockInsertError })
        },
        update: (payload: unknown) => {
          updateSpy(payload)
          return {
            eq: (_: string, __: unknown) => ({
              eq: (_2: string, __2: unknown) =>
                Promise.resolve({ error: mockUpdateError }),
            }),
          }
        },
      }),
    }
  },
}))

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules()
  mockUser = null
  mockClientPresent = true
  mockInsertError = null
  mockUpdateError = null
  mockCountValue = 0
  for (const k of Object.keys(mockSelectData)) delete mockSelectData[k]
  for (const k of Object.keys(mockSelectError)) delete mockSelectError[k]
  insertSpy.mockClear()
  updateSpy.mockClear()
  selectSpy.mockClear()
})

// ---------------------------------------------------------------------------
// 1. resolveMentionsToUserIds
// ---------------------------------------------------------------------------

describe('resolveMentionsToUserIds', () => {
  it('returns empty map when mentions array is empty', async () => {
    mockUser = { id: USER_ID }
    const { resolveMentionsToUserIds } = await import('@/lib/notificationsApi')
    const result = await resolveMentionsToUserIds(WORKBOOK, [])
    expect(result.size).toBe(0)
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('returns empty map when Supabase client is absent', async () => {
    mockClientPresent = false
    const { resolveMentionsToUserIds } = await import('@/lib/notificationsApi')
    const result = await resolveMentionsToUserIds(WORKBOOK, ['priya'])
    expect(result.size).toBe(0)
  })

  it('maps a matching lowercased display_name to user_id', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      {
        user_id: 'priya-uuid',
        profiles: { display_name: 'Priya' },
      },
      {
        user_id: 'raf-uuid',
        profiles: { display_name: 'Rafael' },
      },
    ]
    const { resolveMentionsToUserIds } = await import('@/lib/notificationsApi')
    const result = await resolveMentionsToUserIds(WORKBOOK, ['priya'])
    expect(result.get('priya')).toBe('priya-uuid')
    expect(result.has('rafael')).toBe(false)
  })

  it('normalises handle with spaces removed', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      {
        user_id: 'john-uuid',
        profiles: { display_name: 'John Doe' },
      },
    ]
    const { resolveMentionsToUserIds } = await import('@/lib/notificationsApi')
    // parseMentions() in localCommentsStore lowercases but keeps the
    // raw slug; our normaliser also strips spaces.
    const result = await resolveMentionsToUserIds(WORKBOOK, ['johndoe'])
    expect(result.get('johndoe')).toBe('john-uuid')
  })

  it('returns empty when no member display_name matches', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      { user_id: 'other-uuid', profiles: { display_name: 'Nobody' } },
    ]
    const { resolveMentionsToUserIds } = await import('@/lib/notificationsApi')
    const result = await resolveMentionsToUserIds(WORKBOOK, ['priya'])
    expect(result.size).toBe(0)
  })

  it('skips members with null profiles', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      { user_id: 'ghost-uuid', profiles: null },
    ]
    const { resolveMentionsToUserIds } = await import('@/lib/notificationsApi')
    const result = await resolveMentionsToUserIds(WORKBOOK, ['ghost'])
    expect(result.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. insertMentionNotifications
// ---------------------------------------------------------------------------

describe('insertMentionNotifications', () => {
  it('inserts one notification row per resolved mention', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      { user_id: 'priya-uuid', profiles: { display_name: 'Priya' } },
    ]
    const { insertMentionNotifications } = await import('@/lib/notificationsApi')
    await insertMentionNotifications({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      commentId: COMMENT_ID,
      actorId: USER_ID,
      actorName: 'Vinay',
      mentions: ['priya'],
      body: 'Hey @priya please review this.',
    })
    expect(insertSpy).toHaveBeenCalledOnce()
    const rows = insertSpy.mock.calls[0]?.[0] as Array<{
      user_id: string
      workbook_id: string
      comment_id: string
      actor_id: string
      type: string
      body: string
      read: boolean
    }>
    expect(rows).toHaveLength(1)
    expect(rows[0]?.user_id).toBe('priya-uuid')
    expect(rows[0]?.workbook_id).toBe(WORKBOOK)
    expect(rows[0]?.comment_id).toBe(COMMENT_ID)
    expect(rows[0]?.actor_id).toBe(USER_ID)
    expect(rows[0]?.type).toBe('mention')
    expect(rows[0]?.read).toBe(false)
    expect(rows[0]?.body).toContain('Vinay mentioned you')
    expect(rows[0]?.body).toContain('@priya please review')
  })

  it('inserts multiple rows when multiple mentions resolve', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      { user_id: 'priya-uuid', profiles: { display_name: 'Priya' } },
      { user_id: 'raf-uuid', profiles: { display_name: 'Rafael' } },
    ]
    const { insertMentionNotifications } = await import('@/lib/notificationsApi')
    await insertMentionNotifications({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      commentId: COMMENT_ID,
      actorId: USER_ID,
      actorName: 'Vinay',
      mentions: ['priya', 'rafael'],
      body: 'Hi @priya and @rafael',
    })
    const rows = insertSpy.mock.calls[0]?.[0] as unknown[]
    expect(rows).toHaveLength(2)
  })

  it('does not call insert when no mentions resolve', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      { user_id: 'other-uuid', profiles: { display_name: 'Nobody' } },
    ]
    const { insertMentionNotifications } = await import('@/lib/notificationsApi')
    await insertMentionNotifications({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      commentId: COMMENT_ID,
      actorId: USER_ID,
      actorName: 'Vinay',
      mentions: ['priya'],
      body: 'Hello @priya',
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('does not throw when insert fails', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['workbook_members'] = [
      { user_id: 'priya-uuid', profiles: { display_name: 'Priya' } },
    ]
    mockInsertError = { message: 'rls denied' }
    const { insertMentionNotifications } = await import('@/lib/notificationsApi')
    await expect(
      insertMentionNotifications({
        workbookId: WORKBOOK,
        sheetId: 'sheet1',
        commentId: COMMENT_ID,
        actorId: USER_ID,
        actorName: 'Vinay',
        mentions: ['priya'],
        body: 'Hello @priya',
      })
    ).resolves.toBeUndefined()
  })

  it('no-ops when Supabase client is absent', async () => {
    mockClientPresent = false
    const { insertMentionNotifications } = await import('@/lib/notificationsApi')
    await insertMentionNotifications({
      workbookId: WORKBOOK,
      sheetId: 'sheet1',
      commentId: COMMENT_ID,
      actorId: USER_ID,
      actorName: 'Vinay',
      mentions: ['priya'],
      body: 'hello',
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 3. loadNotifications
// ---------------------------------------------------------------------------

describe('loadNotifications', () => {
  it('returns empty array when not signed in', async () => {
    mockUser = null
    const { loadNotifications } = await import('@/lib/notificationsApi')
    const result = await loadNotifications()
    expect(result).toEqual([])
  })

  it('returns empty array when Supabase client is absent', async () => {
    mockClientPresent = false
    const { loadNotifications } = await import('@/lib/notificationsApi')
    const result = await loadNotifications()
    expect(result).toEqual([])
  })

  it('maps DB rows to NotificationRecord shape', async () => {
    mockUser = { id: USER_ID }
    mockSelectData['notifications'] = [
      {
        id: 'notif-1',
        user_id: USER_ID,
        workbook_id: WORKBOOK,
        sheet_id: 'sheet1',
        comment_id: COMMENT_ID,
        actor_id: 'actor-2',
        type: 'mention',
        body: 'Priya mentioned you: "hello"',
        read: false,
        created_at: '2026-05-20T12:00:00Z',
        profiles: { display_name: 'Priya' },
      },
    ]
    const { loadNotifications } = await import('@/lib/notificationsApi')
    const result = await loadNotifications()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'notif-1',
      workbookId: WORKBOOK,
      commentId: COMMENT_ID,
      type: 'mention',
      read: false,
      actorName: 'Priya',
    })
  })

  it('returns empty array on Supabase error', async () => {
    mockUser = { id: USER_ID }
    mockSelectError['notifications'] = { message: 'rls denied' }
    const { loadNotifications } = await import('@/lib/notificationsApi')
    const result = await loadNotifications()
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 4. markRead / markAllRead
// ---------------------------------------------------------------------------

describe('markRead', () => {
  it('calls Supabase update when signed in', async () => {
    mockUser = { id: USER_ID }
    const { markRead } = await import('@/lib/notificationsApi')
    await markRead('notif-1')
    expect(updateSpy).toHaveBeenCalledWith({ read: true })
  })

  it('no-ops when not signed in', async () => {
    mockUser = null
    const { markRead } = await import('@/lib/notificationsApi')
    await markRead('notif-1')
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('markAllRead', () => {
  it('calls Supabase update for all unread when signed in', async () => {
    mockUser = { id: USER_ID }
    const { markAllRead } = await import('@/lib/notificationsApi')
    await markAllRead()
    expect(updateSpy).toHaveBeenCalledWith({ read: true })
  })
})

// ---------------------------------------------------------------------------
// 5. unreadCount
// ---------------------------------------------------------------------------

describe('unreadCount', () => {
  it('returns the count from Supabase when signed in', async () => {
    mockUser = { id: USER_ID }
    mockCountValue = 5
    const { unreadCount } = await import('@/lib/notificationsApi')
    const c = await unreadCount()
    expect(c).toBe(5)
  })

  it('returns 0 when not signed in', async () => {
    mockUser = null
    const { unreadCount } = await import('@/lib/notificationsApi')
    const c = await unreadCount()
    expect(c).toBe(0)
  })

  it('returns 0 when Supabase client is absent', async () => {
    mockClientPresent = false
    const { unreadCount } = await import('@/lib/notificationsApi')
    const c = await unreadCount()
    expect(c).toBe(0)
  })
})
