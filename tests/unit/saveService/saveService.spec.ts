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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const SESSION_TOKEN = 'mock-access-token'

let mockSession: { access_token: string } | null = null
let mockFetch: ((url: string, init?: RequestInit) => Promise<Response>) | null = null

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: mockSession ? { access_token: mockSession.access_token } : null },
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
  const store: Record<string, string> = {}
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
