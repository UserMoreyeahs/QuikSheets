/**
 * Contract tests for src/lib/cfRulesApi.ts.
 *
 * Mirrors the pattern of tests/unit/commentsApi/commentsApi.spec.ts.
 *
 * Branches covered:
 *   1. No Supabase client (absent env) → localStorage path
 *   2. No session (not signed in) → localStorage path
 *   3. Session + 200 OK from Supabase → rules returned from DB shape
 *   4. Session + DB error on select → localStorage fallback
 *   5. saveRule routes to Supabase (upsert) when signed in
 *   6. saveRule falls back to localStorage when Supabase upsert fails
 *   7. deleteRule routes to Supabase when signed in
 *   8. deleteAllRulesForSheet routes to Supabase when signed in
 *   9. One-time localStorage → Supabase migration on first signed-in load
 *  10. Migration is skipped when the flag is already set
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CFRule } from '@/features/conditional-formatting/types'

const WORKBOOK = 'wb-cf-test-uuid'
const USER_ID = 'user-cf-uuid'
const SHEET_ID = 'sheet1'

// ---------------------------------------------------------------------------
// Helpers to build minimal CFRule fixtures
// ---------------------------------------------------------------------------
function makeRule(overrides?: Partial<CFRule>): CFRule {
  return {
    id: 'cf_test_1',
    range: 'A1:D10',
    condition: { type: 'cell_value', operator: 'greater', value: '5' },
    format: { fill: '#FFEB9C', color: '#9C6500' },
    priority: 0,
    kind: 'standard',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Supabase mock scaffolding
// ---------------------------------------------------------------------------

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
let mockUpsertResponse: { error: { message: string } | null } = { error: null }
let mockDeleteResponse: { error: { message: string } | null } = { error: null }
let mockInsertResponse: { error: { message: string } | null } = { error: null }
let mockClientPresent = true

const upsertSpy = vi.fn()
const deleteSpy = vi.fn()
const insertSpy = vi.fn()

/**
 * Minimal chainable mock that covers the query patterns used in cfRulesApi:
 *
 *   .from('conditional_format_rules')
 *     .select(...).eq(...)                         → mockSelectResponse
 *     .upsert(..., { onConflict: 'id' })           → mockUpsertResponse
 *     .delete().eq(...).eq(...)                    → mockDeleteResponse
 *     .insert([...])                               → mockInsertResponse (migration)
 */
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
            eq: (_col1: string, _val1: string) => ({
              eq: (_col2: string, _val2: string) =>
                Promise.resolve(mockDeleteResponse),
              // bare .eq().then for single-column deletes
              then: (resolve: (v: { error: { message: string } | null }) => void) =>
                resolve(mockDeleteResponse),
            }),
            // Support single-column delete (deleteRule uses .eq('id', ruleId))
            // We need to handle `.delete().eq('id', ruleId)` returning a promise.
            // The mock above returns an object with `eq` — calling `.eq().eq()` or
            // `.eq()` as a promise must both work. We handle the second `.eq` above;
            // the first `.eq` also needs to be awaitable for the single-column path.
          }
        },
        insert: (payload: unknown) => {
          insertSpy(payload)
          return Promise.resolve(mockInsertResponse)
        },
      }),
    }
  },
}))

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules()
  mockUser = null
  mockSelectResponse = { data: [], error: null }
  mockUpsertResponse = { error: null }
  mockDeleteResponse = { error: null }
  mockInsertResponse = { error: null }
  mockClientPresent = true
  upsertSpy.mockClear()
  deleteSpy.mockClear()
  insertSpy.mockClear()

  // Fresh localStorage per test.
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

// ---------------------------------------------------------------------------
// loadRules
// ---------------------------------------------------------------------------

describe('loadRules', () => {
  it('returns localStorage rules when Supabase client is absent', async () => {
    mockClientPresent = false
    // Seed localStorage.
    const rule = makeRule()
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: [rule] })
    )
    const { loadRules } = await import('@/lib/cfRulesApi')
    const result = await loadRules(WORKBOOK)
    expect(result[SHEET_ID]).toHaveLength(1)
    expect(result[SHEET_ID]?.[0]?.id).toBe(rule.id)
  })

  it('returns localStorage rules when there is no signed-in user', async () => {
    const rule = makeRule({ id: 'cf_local_only' })
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: [rule] })
    )
    const { loadRules } = await import('@/lib/cfRulesApi')
    const result = await loadRules(WORKBOOK)
    expect(result[SHEET_ID]?.[0]?.id).toBe('cf_local_only')
  })

  it('returns DB rows when a session is present', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    // Pre-set the migration flag so we skip the upload path in this test.
    window.localStorage.setItem(`quiksheets_cf_migrated_to_supabase:${WORKBOOK}`, 'true')

    const rule = makeRule({ id: 'cf_from_db' })
    mockSelectResponse = {
      data: [
        {
          id: rule.id,
          workbook_id: WORKBOOK,
          sheet_id: SHEET_ID,
          range_ref: rule.range,
          rule_json: rule,
          created_by: USER_ID,
          created_at: '2026-05-20T10:00:00Z',
          updated_at: '2026-05-20T10:00:00Z',
        },
      ],
      error: null,
    }
    const { loadRules } = await import('@/lib/cfRulesApi')
    const result = await loadRules(WORKBOOK)
    expect(result[SHEET_ID]).toHaveLength(1)
    expect(result[SHEET_ID]?.[0]?.id).toBe('cf_from_db')
  })

  it('falls back to localStorage when the Supabase select errors', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: null, error: { message: 'rls denied' } }
    window.localStorage.setItem(`quiksheets_cf_migrated_to_supabase:${WORKBOOK}`, 'true')
    const rule = makeRule({ id: 'cf_cached' })
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: [rule] })
    )
    const { loadRules } = await import('@/lib/cfRulesApi')
    const result = await loadRules(WORKBOOK)
    expect(result[SHEET_ID]?.[0]?.id).toBe('cf_cached')
  })
})

// ---------------------------------------------------------------------------
// saveRule / updateRule
// ---------------------------------------------------------------------------

describe('saveRule', () => {
  it('upserts to Supabase when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const rule = makeRule()
    const { saveRule } = await import('@/lib/cfRulesApi')
    await saveRule(WORKBOOK, SHEET_ID, rule)
    expect(upsertSpy).toHaveBeenCalledOnce()
    const payload = upsertSpy.mock.calls[0]?.[0] as {
      id: string
      workbook_id: string
      sheet_id: string
      range_ref: string
      created_by: string
    }
    expect(payload.id).toBe(rule.id)
    expect(payload.workbook_id).toBe(WORKBOOK)
    expect(payload.sheet_id).toBe(SHEET_ID)
    expect(payload.range_ref).toBe(rule.range)
    expect(payload.created_by).toBe(USER_ID)
  })

  it('writes to localStorage even when Supabase is absent', async () => {
    mockClientPresent = false
    const rule = makeRule({ id: 'cf_offline' })
    const { saveRule } = await import('@/lib/cfRulesApi')
    await saveRule(WORKBOOK, SHEET_ID, rule)
    const raw = window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as Record<string, CFRule[]>
    expect(parsed[SHEET_ID]?.[0]?.id).toBe('cf_offline')
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('still writes to localStorage when the Supabase upsert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockUpsertResponse = { error: { message: 'constraint violation' } }
    const rule = makeRule({ id: 'cf_upsert_fail' })
    const { saveRule } = await import('@/lib/cfRulesApi')
    await saveRule(WORKBOOK, SHEET_ID, rule)
    // localStorage must still have the rule.
    const raw = window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)
    const parsed = JSON.parse(raw!) as Record<string, CFRule[]>
    expect(parsed[SHEET_ID]?.[0]?.id).toBe('cf_upsert_fail')
  })
})

// ---------------------------------------------------------------------------
// deleteRule
// ---------------------------------------------------------------------------

describe('deleteRule', () => {
  it('deletes from Supabase when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const rule = makeRule()
    // Pre-populate localStorage.
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: [rule] })
    )
    const { deleteRule } = await import('@/lib/cfRulesApi')
    await deleteRule(WORKBOOK, SHEET_ID, rule.id)
    expect(deleteSpy).toHaveBeenCalledOnce()
    // Also removed from localStorage.
    const raw = window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)
    const parsed = JSON.parse(raw!) as Record<string, CFRule[]>
    expect(parsed[SHEET_ID]).toHaveLength(0)
  })

  it('removes from localStorage when there is no session', async () => {
    const rule = makeRule({ id: 'cf_delete_offline' })
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: [rule] })
    )
    const { deleteRule } = await import('@/lib/cfRulesApi')
    await deleteRule(WORKBOOK, SHEET_ID, rule.id)
    expect(deleteSpy).not.toHaveBeenCalled()
    const raw = window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)
    const parsed = JSON.parse(raw!) as Record<string, CFRule[]>
    expect(parsed[SHEET_ID]).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// deleteAllRulesForSheet
// ---------------------------------------------------------------------------

describe('deleteAllRulesForSheet', () => {
  it('clears localStorage and calls Supabase delete when signed in', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    const rules = [makeRule({ id: 'cf_a' }), makeRule({ id: 'cf_b' })]
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: rules })
    )
    const { deleteAllRulesForSheet } = await import('@/lib/cfRulesApi')
    await deleteAllRulesForSheet(WORKBOOK, SHEET_ID)
    expect(deleteSpy).toHaveBeenCalledOnce()
    const raw = window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)
    const parsed = JSON.parse(raw!) as Record<string, CFRule[]>
    expect(parsed[SHEET_ID]).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// One-time localStorage → Supabase migration
// ---------------------------------------------------------------------------

describe('one-time localStorage → Supabase migration', () => {
  it('uploads existing local rules and sets the migration flag', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockInsertResponse = { error: null }

    const rules = [makeRule({ id: 'cf_migrate_1' }), makeRule({ id: 'cf_migrate_2', range: 'B1:B50' })]
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: rules })
    )

    const { loadRules } = await import('@/lib/cfRulesApi')
    await loadRules(WORKBOOK)

    // Migration insert was called.
    expect(insertSpy).toHaveBeenCalledOnce()
    const payload = insertSpy.mock.calls[0]?.[0] as Array<{ id: string; workbook_id: string }>
    expect(payload).toHaveLength(2)
    expect(payload.map((p) => p.id).sort()).toEqual(['cf_migrate_1', 'cf_migrate_2'].sort())
    expect(payload[0]?.workbook_id).toBe(WORKBOOK)

    // Flag is set.
    expect(
      window.localStorage.getItem(`quiksheets_cf_migrated_to_supabase:${WORKBOOK}`)
    ).toBe('true')

    // Local rules cleared.
    expect(window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)).toBeNull()
  })

  it('does NOT clear local rules when the insert fails', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    mockInsertResponse = { error: { message: 'rls denied' } }

    const rules = [makeRule({ id: 'cf_keep_on_fail' })]
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: rules })
    )

    const { loadRules } = await import('@/lib/cfRulesApi')
    await loadRules(WORKBOOK)

    // Flag should NOT be set.
    expect(
      window.localStorage.getItem(`quiksheets_cf_migrated_to_supabase:${WORKBOOK}`)
    ).toBeNull()

    // Local rules still present.
    const raw = window.localStorage.getItem(`quiksheets_cf_rules:${WORKBOOK}`)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as Record<string, CFRule[]>
    expect(parsed[SHEET_ID]).toHaveLength(1)
  })

  it('skips migration when the flag is already set', async () => {
    mockUser = { id: USER_ID, email: 'u@e.co', user_metadata: {} }
    mockSelectResponse = { data: [], error: null }
    window.localStorage.setItem(`quiksheets_cf_migrated_to_supabase:${WORKBOOK}`, 'true')

    const rules = [makeRule({ id: 'cf_should_not_migrate' })]
    window.localStorage.setItem(
      `quiksheets_cf_rules:${WORKBOOK}`,
      JSON.stringify({ [SHEET_ID]: rules })
    )

    const { loadRules } = await import('@/lib/cfRulesApi')
    await loadRules(WORKBOOK)

    // No insert attempted.
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
