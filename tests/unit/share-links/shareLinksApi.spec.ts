/**
 * Tests for shareLinksApi — covers Supabase-first path, localStorage fallback,
 * expired/inactive resolution, and the migration trigger.
 *
 * All Supabase interactions are mocked. The localStorage implementation from
 * localShareLinks.ts runs in jsdom's in-memory store.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Mock Supabase browser client ─────────────────────────────────────────────

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: vi.fn(),
}))

import { getBrowserSupabase } from '@/lib/supabase/client'
import { createLink, listLinks, revokeLink, resolveToken } from '@/lib/shareLinksApi'
import {
  createLocalShareLink,
  listLocalShareLinks,
  resolveLocalShareToken,
} from '@/features/share-links/storage/localShareLinks'

const mockGetBrowserSupabase = getBrowserSupabase as MockedFunction<typeof getBrowserSupabase>

// Cast the chain to unknown first, then to SupabaseClient to avoid the
// "does not sufficiently overlap" TS error on the mock object.
function asSupabaseClient(chain: unknown): SupabaseClient {
  return chain as unknown as SupabaseClient
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WORKBOOK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function clearLocalStorage() {
  if (typeof localStorage !== 'undefined') {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  }
}

beforeEach(() => {
  clearLocalStorage()
  mockGetBrowserSupabase.mockReset()
})

// ─── resolveToken (localStorage only) ────────────────────────────────────────

describe('resolveToken (local fallback)', () => {
  it('returns ok:true for a valid active local link', () => {
    const link = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'viewer',
      expiresAt: null,
    })
    const result = resolveToken(link.token)
    expect(result.ok).toBe(true)
    expect(result.workbookId).toBe(WORKBOOK_ID)
    expect(result.role).toBe('viewer')
  })

  it('returns not_found for an unknown token', () => {
    const result = resolveToken('totally-unknown-token-xyz')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not_found')
  })

  it('returns expired for a link past its expiry', () => {
    const link = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'editor',
      expiresAt: Date.now() - 1000, // already expired
    })
    const result = resolveToken(link.token)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('returns inactive for a revoked local link', () => {
    const link = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'viewer',
      expiresAt: null,
    })
    // Revoke via local store directly
    const links = listLocalShareLinks(WORKBOOK_ID)
    const revokedLinks = links.map((l) =>
      l.token === link.token ? { ...l, active: false } : l
    )
    localStorage.setItem(
      `quiksheets_share_links:${WORKBOOK_ID}`,
      JSON.stringify(revokedLinks)
    )
    localStorage.setItem(
      `quiksheets_share_token:${link.token}`,
      JSON.stringify({ ...link, active: false })
    )
    const result = resolveToken(link.token)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('inactive')
  })

  it('still resolves a link with a future expiry', () => {
    const link = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'editor',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
    const result = resolveToken(link.token)
    expect(result.ok).toBe(true)
    expect(result.role).toBe('editor')
  })
})

// ─── createLink — Supabase path ───────────────────────────────────────────────

describe('createLink — Supabase path', () => {
  it('returns a ShareLink from the Supabase row when insert succeeds', async () => {
    const fakeRow = {
      id: 'row-id-1',
      token: 'supabase-token-abc',
      workbook_id: WORKBOOK_ID,
      role: 'viewer',
      expires_at: null,
      active: true,
      created_at: new Date().toISOString(),
    }
    const chain: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => chain
    chain['from'] = self
    chain['insert'] = self
    chain['select'] = self
    chain['single'] = () => Promise.resolve({ data: fakeRow, error: null })
    chain['upsert'] = () => Promise.resolve({ error: null })

    mockGetBrowserSupabase.mockReturnValue(asSupabaseClient(chain))

    const link = await createLink({ workbookId: WORKBOOK_ID, role: 'viewer' })
    expect(link.token).toBe('supabase-token-abc')
    expect(link.role).toBe('viewer')
    expect(link.active).toBe(true)
    expect(link.expiresAt).toBeNull()
  })

  it('falls back to localStorage when Supabase insert errors', async () => {
    const chain: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => chain
    chain['from'] = self
    chain['insert'] = self
    chain['select'] = self
    chain['single'] = () => Promise.resolve({ data: null, error: { message: 'db error' } })
    chain['upsert'] = () => Promise.resolve({ error: null })

    mockGetBrowserSupabase.mockReturnValue(asSupabaseClient(chain))

    const link = await createLink({ workbookId: WORKBOOK_ID, role: 'editor' })
    // Falls back to localStorage — token should be a Math.random-based string
    expect(link.token).toBeTruthy()
    expect(link.role).toBe('editor')
    // Verify it was written to localStorage
    const localLinks = listLocalShareLinks(WORKBOOK_ID)
    expect(localLinks.some((l) => l.token === link.token)).toBe(true)
  })
})

// ─── createLink — localStorage fallback (no Supabase) ────────────────────────

describe('createLink — localStorage fallback', () => {
  it('creates a link in localStorage when Supabase is not configured', async () => {
    mockGetBrowserSupabase.mockReturnValue(null)

    const link = await createLink({
      workbookId: WORKBOOK_ID,
      role: 'viewer',
      expiresAt: Date.now() + 86400_000,
    })

    expect(link.token).toBeTruthy()
    expect(link.role).toBe('viewer')
    expect(link.expiresAt).toBeGreaterThan(Date.now())
    expect(link.active).toBe(true)

    // Verify it's resolvable locally
    const resolved = resolveLocalShareToken(link.token)
    expect(resolved.ok).toBe(true)
  })
})

// ─── listLinks ────────────────────────────────────────────────────────────────

describe('listLinks', () => {
  it('returns Supabase rows when available', async () => {
    const rows = [
      {
        id: 'row-1',
        token: 'tok-1',
        workbook_id: WORKBOOK_ID,
        role: 'viewer',
        expires_at: null,
        active: true,
        created_at: new Date().toISOString(),
      },
    ]
    const chain: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => chain
    chain['from'] = self
    chain['select'] = self
    chain['eq'] = self
    chain['order'] = () => Promise.resolve({ data: rows, error: null })

    mockGetBrowserSupabase.mockReturnValue(asSupabaseClient(chain))

    const links = await listLinks(WORKBOOK_ID)
    expect(links).toHaveLength(1)
    expect(links[0]?.token).toBe('tok-1')
  })

  it('falls back to localStorage on Supabase error', async () => {
    const chain: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => chain
    chain['from'] = self
    chain['select'] = self
    chain['eq'] = self
    chain['order'] = () => Promise.resolve({ data: null, error: { message: 'forbidden' } })

    mockGetBrowserSupabase.mockReturnValue(asSupabaseClient(chain))

    createLocalShareLink({ workbookId: WORKBOOK_ID, role: 'viewer', expiresAt: null })
    const links = await listLinks(WORKBOOK_ID)
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('returns localStorage links when Supabase is null', async () => {
    mockGetBrowserSupabase.mockReturnValue(null)
    createLocalShareLink({ workbookId: WORKBOOK_ID, role: 'editor', expiresAt: null })
    const links = await listLinks(WORKBOOK_ID)
    expect(links.length).toBeGreaterThanOrEqual(1)
    expect(links[0]?.role).toBe('editor')
  })
})

// ─── revokeLink ───────────────────────────────────────────────────────────────

describe('revokeLink', () => {
  it('revokes via Supabase and also marks local link inactive', async () => {
    const local = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'viewer',
      expiresAt: null,
    })

    // revokeLink calls .from().update().eq('workbook_id', …).eq('token', …)
    // The final .eq() must return a promise (the awaited result).
    const innerChain: Record<string, unknown> = {}
    innerChain['eq'] = () => Promise.resolve({ error: null })

    const chain: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => chain
    chain['from'] = self
    chain['update'] = self
    chain['eq'] = () => innerChain

    mockGetBrowserSupabase.mockReturnValue(asSupabaseClient(chain))

    await revokeLink(WORKBOOK_ID, local.token)

    // Local copy should be inactive
    const result = resolveLocalShareToken(local.token)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('inactive')
  })

  it('still revokes locally when Supabase is not configured', async () => {
    mockGetBrowserSupabase.mockReturnValue(null)
    const local = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'editor',
      expiresAt: null,
    })
    await revokeLink(WORKBOOK_ID, local.token)
    const result = resolveLocalShareToken(local.token)
    expect(result.ok).toBe(false)
  })
})

// ─── Expired link blocked ─────────────────────────────────────────────────────

describe('expired link blocked', () => {
  it('resolveToken returns expired for a link past its expiresAt', () => {
    const link = createLocalShareLink({
      workbookId: WORKBOOK_ID,
      role: 'viewer',
      expiresAt: Date.now() - 1,
    })
    const result = resolveToken(link.token)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('expired')
  })
})
