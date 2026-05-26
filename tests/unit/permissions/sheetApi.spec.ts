/**
 * Contract tests for src/lib/sheetApi.ts.
 *
 * Pins down the MVP T011 invariant: when a user has been invited as an
 * editor (row in workbook_members), they must be able to:
 *   - load the workbook through loadWorkbookRecord
 *   - save edits through saveWorkbookRecord
 *
 * Before the T011 fix these tests would have failed because the owner
 * filter ran without a membership fallback. They serve as a regression
 * fence against future accidental over-restriction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

interface MockRow {
  workbook_id?: string
  user_id?: string
  role?: string
  id?: string
  name?: string
  data?: unknown
}

interface MockTableState {
  rows: MockRow[]
}

// Build a tiny in-memory "supabase client" that supports the subset
// of operations sheetApi.ts uses: from(table).select().eq().maybeSingle/single,
// .insert().select().single, .update().eq().select().maybeSingle.
function makeMockClient(state: Record<string, MockTableState>) {
  function from(table: string) {
    const filters: Array<[string, unknown]> = []
    let pendingUpdate: MockRow | null = null
    let pendingInsert: MockRow | null = null

    const chain = {
      select(_fields: string) { return chain },
      eq(col: string, val: unknown) { filters.push([col, val]); return chain },
      update(values: MockRow) { pendingUpdate = values; return chain },
      insert(values: MockRow) { pendingInsert = values; return chain },
      async maybeSingle() {
        return resolve('maybeSingle')
      },
      async single() {
        return resolve('single')
      },
    }

    function resolve(_mode: 'maybeSingle' | 'single') {
      const t = state[table]
      if (!t) return { data: null, error: { message: 'no such table' } }

      // INSERT: append a row, then return it via single()
      if (pendingInsert) {
        const row: MockRow = { ...pendingInsert, id: pendingInsert.id ?? `mock-${Math.random().toString(36).slice(2, 8)}` }
        t.rows.push(row)
        return { data: row, error: null }
      }

      // UPDATE: find rows matching filters, apply patch, return one of them
      if (pendingUpdate) {
        const matching = t.rows.filter((r) => filters.every(([k, v]) => r[k as keyof MockRow] === v))
        for (const row of matching) Object.assign(row, pendingUpdate)
        return { data: matching[0] ?? null, error: null }
      }

      // SELECT: find rows matching filters
      const matching = t.rows.filter((r) => filters.every(([k, v]) => r[k as keyof MockRow] === v))
      return { data: matching[0] ?? null, error: null }
    }

    return chain
  }
  return { from }
}

const supabaseState: Record<string, MockTableState> = {
  workbooks:        { rows: [] },
  workbook_members: { rows: [] },
}

vi.mock('@/lib/supabase', () => ({
  get supabase() { return makeMockClient(supabaseState) },
}))

vi.mock('@/lib/supabase/server', () => ({
  getServiceRoleSupabase: () => makeMockClient(supabaseState),
}))

// Import after mocks so the module picks them up.
let sheetApi: typeof import('@/lib/sheetApi')
beforeEach(async () => {
  vi.resetModules()
  supabaseState.workbooks.rows = []
  supabaseState.workbook_members.rows = []
  sheetApi = await import('@/lib/sheetApi')
})

// ─── Fixtures ───────────────────────────────────────────────────────────

const WORKBOOK_ID = 'wb_test'
const OWNER_ID    = 'user_owner'
const EDITOR_ID   = 'user_editor'
const VIEWER_ID   = 'user_viewer'
const STRANGER_ID = 'user_stranger'

function seedWorkbook() {
  supabaseState.workbooks.rows.push({
    id: WORKBOOK_ID,
    name: 'Q1 Sales Ops',
    data: { sheets: ['Sheet1'] },
    user_id: OWNER_ID, // unused but harmless
    workbook_id: WORKBOOK_ID,
  })
  // owner_id stored on the workbook row
  supabaseState.workbooks.rows[0]!['owner_id' as keyof MockRow] = OWNER_ID as never
}

function seedMember(userId: string, role: 'owner' | 'editor' | 'viewer') {
  supabaseState.workbook_members.rows.push({
    workbook_id: WORKBOOK_ID,
    user_id: userId,
    role,
  })
}

// ─── loadWorkbookRecord ─────────────────────────────────────────────────

describe('loadWorkbookRecord', () => {
  it('owner can load their workbook', async () => {
    seedWorkbook()
    const result = await sheetApi.loadWorkbookRecord(WORKBOOK_ID, OWNER_ID)
    expect('response' in result).toBe(false)
    if ('response' in result) return
    expect(result.name).toBe('Q1 Sales Ops')
  })

  it('invited editor can load the workbook (T011 regression)', async () => {
    seedWorkbook()
    seedMember(EDITOR_ID, 'editor')
    const result = await sheetApi.loadWorkbookRecord(WORKBOOK_ID, EDITOR_ID)
    expect('response' in result).toBe(false)
    if ('response' in result) {
      throw new Error('expected workbook payload, got error response')
    }
    expect(result.name).toBe('Q1 Sales Ops')
  })

  it('invited viewer can also load (read-only is still read)', async () => {
    seedWorkbook()
    seedMember(VIEWER_ID, 'viewer')
    const result = await sheetApi.loadWorkbookRecord(WORKBOOK_ID, VIEWER_ID)
    expect('response' in result).toBe(false)
  })

  it('stranger cannot load — 404', async () => {
    seedWorkbook()
    const result = await sheetApi.loadWorkbookRecord(WORKBOOK_ID, STRANGER_ID)
    expect('response' in result).toBe(true)
    if (!('response' in result)) return
    expect(result.response.status).toBe(404)
  })
})

// ─── saveWorkbookRecord ─────────────────────────────────────────────────

describe('saveWorkbookRecord', () => {
  it('owner can update their workbook', async () => {
    seedWorkbook()
    const result = await sheetApi.saveWorkbookRecord(
      { id: WORKBOOK_ID, name: 'Renamed', data: { v: 1 } },
      OWNER_ID,
    )
    expect('response' in result).toBe(false)
  })

  it('editor member can update (T011 regression)', async () => {
    seedWorkbook()
    seedMember(EDITOR_ID, 'editor')
    const result = await sheetApi.saveWorkbookRecord(
      { id: WORKBOOK_ID, name: 'Edited by editor', data: { v: 2 } },
      EDITOR_ID,
    )
    expect('response' in result).toBe(false)
  })

  it('viewer cannot update — 403', async () => {
    seedWorkbook()
    seedMember(VIEWER_ID, 'viewer')
    const result = await sheetApi.saveWorkbookRecord(
      { id: WORKBOOK_ID, name: 'Sneaky viewer', data: { v: 3 } },
      VIEWER_ID,
    )
    expect('response' in result).toBe(true)
    if (!('response' in result)) return
    expect(result.response.status).toBe(403)
  })

  it('stranger cannot update — 403', async () => {
    seedWorkbook()
    const result = await sheetApi.saveWorkbookRecord(
      { id: WORKBOOK_ID, name: 'Stranger danger', data: { v: 4 } },
      STRANGER_ID,
    )
    expect('response' in result).toBe(true)
    if (!('response' in result)) return
    expect(result.response.status).toBe(403)
  })

  it('any authenticated user can create a new workbook (insert path)', async () => {
    const result = await sheetApi.saveWorkbookRecord(
      { name: 'New WB', data: { v: 0 } },
      STRANGER_ID,
    )
    expect('response' in result).toBe(false)
    if ('response' in result) return
    expect(typeof result.id).toBe('string')
  })
})
