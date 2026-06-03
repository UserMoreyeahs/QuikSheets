/**
 * Contract tests for src/lib/formsApi.ts.
 *
 * Pins down the Quiksheets forms migration from localStorage to
 * Supabase:
 *   - createForm / loadForms / getFormBySlug / submitForm / deleteForm
 *     all use the new column names (fields, accepts_submissions, values).
 *   - submitForm works for anonymous visitors (no auth header required
 *     by the API; RLS gates server-side via the public policy).
 *   - All read/write APIs fall back to localStorage when Supabase
 *     isn't configured.
 *   - migrateLocalFormsToSupabase only runs once and clears the locals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory mock Supabase client ────────────────────────────────────────

interface MockRow {
  [key: string]: unknown
}

interface MockTableState {
  rows: MockRow[]
}

const supabaseState: { forms: MockTableState; form_submissions: MockTableState } & Record<string, MockTableState> = {
  forms: { rows: [] },
  form_submissions: { rows: [] },
}

let supabaseConfigured = true
let mockUser: { id: string } | null = { id: 'user_owner' }

function makeMockClient() {
  function from(table: string) {
    const filters: Array<[string, unknown]> = []
    let pendingUpdate: MockRow | null = null
    let pendingInsert: MockRow | MockRow[] | null = null
    let pendingDelete = false
    let pendingUpsert: { row: MockRow; onConflict?: string } | null = null

    const chain = {
      select(_fields?: string) { return chain },
      eq(col: string, val: unknown) { filters.push([col, val]); return chain },
      update(values: MockRow) { pendingUpdate = values; return chain },
      insert(values: MockRow | MockRow[]) { pendingInsert = values; return chain },
      upsert(values: MockRow, opts?: { onConflict?: string }) {
        pendingUpsert = { row: values, ...(opts ?? {}) }
        return chain
      },
      delete() { pendingDelete = true; return chain },
      order(_column: string, _opts?: { ascending?: boolean }) {
        // Order is irrelevant for the mock — we just need the chain to be
        // a no-op so the call site doesn't error.
        return chain
      },
      maybeSingle: async () => resolve('maybeSingle'),
      single: async () => resolve('single'),
      then(onFulfilled: (val: unknown) => unknown) {
        return Promise.resolve(resolve('list')).then(onFulfilled)
      },
    }

    function matchesFilters(row: MockRow): boolean {
      return filters.every(([k, v]) => row[k] === v)
    }

    function resolve(mode: 'maybeSingle' | 'single' | 'list') {
      const t = supabaseState[table]
      if (!t) return { data: null, error: { message: 'no such table' } }

      if (pendingInsert) {
        const rows = Array.isArray(pendingInsert) ? pendingInsert : [pendingInsert]
        const inserted: MockRow[] = []
        for (const r of rows) {
          const row: MockRow = {
            ...r,
            id: r.id ?? `mock-${Math.random().toString(36).slice(2, 8)}`,
          }
          t.rows.push(row)
          inserted.push(row)
        }
        if (mode === 'single' || mode === 'maybeSingle') {
          return { data: inserted[0] ?? null, error: null }
        }
        return { data: inserted, error: null }
      }

      if (pendingUpsert) {
        const r = pendingUpsert.row
        const conflictKey = pendingUpsert.onConflict ?? 'id'
        const existingIdx = t.rows.findIndex((row) => row[conflictKey] === r[conflictKey])
        if (existingIdx >= 0) {
          t.rows[existingIdx] = { ...t.rows[existingIdx], ...r }
        } else {
          t.rows.push({ ...r, id: r.id ?? `mock-${Math.random().toString(36).slice(2, 8)}` })
        }
        return { data: r, error: null }
      }

      if (pendingDelete) {
        const before = t.rows.length
        t.rows = t.rows.filter((row) => !matchesFilters(row))
        return { data: { deleted: before - t.rows.length }, error: null }
      }

      if (pendingUpdate) {
        const matching = t.rows.filter(matchesFilters)
        for (const row of matching) Object.assign(row, pendingUpdate)
        if (mode === 'list') return { data: matching, error: null }
        return { data: matching[0] ?? null, error: null }
      }

      const matching = t.rows.filter(matchesFilters)
      if (mode === 'list') {
        return { data: matching, error: null }
      }
      return { data: matching[0] ?? null, error: null }
    }

    return chain
  }

  return {
    from,
    auth: {
      async getUser() {
        return { data: { user: mockUser }, error: null }
      },
    },
  }
}

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => (supabaseConfigured ? makeMockClient() : null),
}))

// ── localStorage stub ─────────────────────────────────────────────────────

function installLocalStorage() {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    get length() {
      return Object.keys(store).length
    },
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
  })
  vi.stubGlobal('window', { localStorage })
  vi.stubGlobal('crypto', {
    randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
  })
  return store
}

// ── Test setup ────────────────────────────────────────────────────────────

let api: typeof import('@/lib/formsApi')

beforeEach(async () => {
  vi.resetModules()
  supabaseState.forms.rows = []
  supabaseState.form_submissions.rows = []
  supabaseConfigured = true
  mockUser = { id: 'user_owner' }
  installLocalStorage()
  api = await import('@/lib/formsApi')
})

const WORKBOOK_ID = '00000000-0000-0000-0000-000000000001'
const SHEET_ID = 'sheet1'

const SAMPLE_FIELDS = [
  { id: 'f-name', label: 'Name', columnIndex: 0, kind: 'text' as const, required: true },
  { id: 'f-email', label: 'Email', columnIndex: 1, kind: 'email' as const, required: true },
]

// ── createForm ────────────────────────────────────────────────────────────

describe('createForm', () => {
  it('inserts a row into forms with the new column names', async () => {
    const result = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Customer Intake',
      fields: SAMPLE_FIELDS,
    })
    expect(result.id).toBeTruthy()
    expect(result.slug).toMatch(/^customer-intake-[a-z0-9]+$/)
    expect(supabaseState.forms.rows).toHaveLength(1)
    const row = supabaseState.forms.rows[0]!
    expect(row.workbook_id).toBe(WORKBOOK_ID)
    expect(row.sheet_id).toBe(SHEET_ID)
    expect(row.fields).toEqual(SAMPLE_FIELDS)
    expect(row.accepts_submissions).toBe(true)
    // Confirm we are NOT writing the legacy column names.
    expect(row.fields_json).toBeUndefined()
    expect(row.is_public).toBeUndefined()
  })

  it('falls back to localStorage when Supabase is not configured', async () => {
    supabaseConfigured = false
    vi.resetModules()
    api = await import('@/lib/formsApi')
    const result = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Offline Form',
      fields: SAMPLE_FIELDS,
    })
    expect(result.id).toBeTruthy()
    expect(supabaseState.forms.rows).toHaveLength(0)
    // localStorage should hold the form.
    const raw = localStorage.getItem(`quiksheets_form:${result.id}`)
    expect(raw).toBeTruthy()
  })
})

// ── loadForms ─────────────────────────────────────────────────────────────

describe('loadForms', () => {
  it('returns all forms for the workbook', async () => {
    await api.createForm({ workbookId: WORKBOOK_ID, sheetId: SHEET_ID, name: 'A', fields: SAMPLE_FIELDS })
    await api.createForm({ workbookId: WORKBOOK_ID, sheetId: SHEET_ID, name: 'B', fields: SAMPLE_FIELDS })
    const list = await api.loadForms(WORKBOOK_ID)
    expect(list).toHaveLength(2)
  })
})

// ── getFormBySlug ─────────────────────────────────────────────────────────

describe('getFormBySlug', () => {
  it('returns the form definition for a known slug', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Lookup Test',
      fields: SAMPLE_FIELDS,
    })
    const found = await api.getFormBySlug(created.slug)
    expect(found).toBeTruthy()
    expect(found?.name).toBe('Lookup Test')
    expect(found?.fields).toEqual(SAMPLE_FIELDS)
  })

  it('returns null for an unknown slug', async () => {
    const found = await api.getFormBySlug('does-not-exist')
    expect(found).toBeNull()
  })
})

// ── submitForm ────────────────────────────────────────────────────────────

describe('submitForm', () => {
  it('inserts a row into form_submissions using the new column names', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Submit Test',
      fields: SAMPLE_FIELDS,
    })
    const result = await api.submitForm(
      created.slug,
      { 'f-name': 'Jane', 'f-email': 'jane@example.com' },
      'jane@example.com',
    )
    expect(result.ok).toBe(true)
    expect(result.id).toBeTruthy()
    expect(supabaseState.form_submissions.rows).toHaveLength(1)
    const row = supabaseState.form_submissions.rows[0]!
    expect(row.form_id).toBe(created.id)
    expect(row.values).toEqual({ 'f-name': 'Jane', 'f-email': 'jane@example.com' })
    expect(row.submitter_email).toBe('jane@example.com')
    // Confirm we are NOT writing the legacy column names.
    expect(row.submission_json).toBeUndefined()
  })

  it('rejects submission when the form is closed', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Closed Form',
      fields: SAMPLE_FIELDS,
      acceptsSubmissions: false,
    })
    const result = await api.submitForm(created.slug, { 'f-name': 'Jane' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/closed/i)
    expect(supabaseState.form_submissions.rows).toHaveLength(0)
  })

  it('returns an error for an unknown slug', async () => {
    const result = await api.submitForm('nope', { x: 1 })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  it('works even when the user is signed out (anon submit)', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Anon submit',
      fields: SAMPLE_FIELDS,
    })
    // Pretend the visitor is anonymous — no auth user. The "anyone can
    // submit" RLS policy means we should still insert successfully.
    mockUser = null
    const result = await api.submitForm(created.slug, { 'f-name': 'Anon' })
    expect(result.ok).toBe(true)
    expect(result.id).toBeTruthy()
  })

  it('also queues the submission locally so the workbook merge sees it', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Merge bridge',
      fields: SAMPLE_FIELDS,
    })
    await api.submitForm(created.slug, { 'f-name': 'Carol' })
    const pending = api.takePendingSubmissions(created.id!)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.values['f-name']).toBe('Carol')
    // takePendingSubmissions empties the queue.
    expect(api.takePendingSubmissions(created.id!)).toHaveLength(0)
  })
})

// ── deleteForm ────────────────────────────────────────────────────────────

describe('deleteForm', () => {
  it('removes the form from Supabase', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Delete me',
      fields: SAMPLE_FIELDS,
    })
    expect(supabaseState.forms.rows).toHaveLength(1)
    await api.deleteForm(created.id!)
    expect(supabaseState.forms.rows).toHaveLength(0)
  })
})

// ── listSubmissions ──────────────────────────────────────────────────────

describe('listSubmissions', () => {
  it('returns past submissions for a form', async () => {
    const created = await api.createForm({
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Stats',
      fields: SAMPLE_FIELDS,
    })
    await api.submitForm(created.slug, { 'f-name': 'A' })
    await api.submitForm(created.slug, { 'f-name': 'B' })
    const subs = await api.listSubmissions(created.id!)
    expect(subs).toHaveLength(2)
  })
})

// ── migrateLocalFormsToSupabase ──────────────────────────────────────────

describe('migrateLocalFormsToSupabase', () => {
  it('uploads local forms and clears the locals', async () => {
    // Seed a legacy localStorage form record.
    const legacy = {
      id: 'legacy-id',
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Legacy Form',
      slug: 'legacy-form',
      isPublic: true,
      fields: SAMPLE_FIELDS,
      createdAt: 1700000000000,
    }
    localStorage.setItem(`quiksheets_form:${legacy.id}`, JSON.stringify(legacy))
    localStorage.setItem(`quiksheets_forms_index:${WORKBOOK_ID}`, JSON.stringify([legacy.id]))
    localStorage.setItem(`quiksheets_form_slug:${legacy.slug}`, legacy.id)

    const migrated = await api.migrateLocalFormsToSupabase()
    expect(migrated).toBe(1)
    expect(supabaseState.forms.rows).toHaveLength(1)
    expect(supabaseState.forms.rows[0]?.slug).toBe('legacy-form')
    expect(supabaseState.forms.rows[0]?.accepts_submissions).toBe(true)
    // Locals were cleaned.
    expect(localStorage.getItem(`quiksheets_form:${legacy.id}`)).toBeNull()
    // Flag set so a re-run is a no-op.
    expect(localStorage.getItem('quiksheets_forms_migrated_to_supabase')).toBe('true')
    const second = await api.migrateLocalFormsToSupabase()
    expect(second).toBe(0)
  })

  it('is a safe no-op when there are no local forms', async () => {
    const migrated = await api.migrateLocalFormsToSupabase()
    expect(migrated).toBe(0)
    expect(localStorage.getItem('quiksheets_forms_migrated_to_supabase')).toBe('true')
  })

  it('does nothing if the user is signed out', async () => {
    mockUser = null
    const legacy = {
      id: 'legacy-id',
      workbookId: WORKBOOK_ID,
      sheetId: SHEET_ID,
      name: 'Legacy Form',
      slug: 'legacy-form',
      isPublic: true,
      fields: SAMPLE_FIELDS,
      createdAt: 1700000000000,
    }
    localStorage.setItem(`quiksheets_form:${legacy.id}`, JSON.stringify(legacy))
    localStorage.setItem(`quiksheets_forms_index:${WORKBOOK_ID}`, JSON.stringify([legacy.id]))
    const migrated = await api.migrateLocalFormsToSupabase()
    expect(migrated).toBe(0)
    // Local form preserved for next time.
    expect(localStorage.getItem(`quiksheets_form:${legacy.id}`)).toBeTruthy()
  })
})
