'use client'

/**
 * formsApi — canonical client-side API for the Quiksheets Forms feature.
 *
 * Replaces src/features/forms/storage/localFormStore.ts. Reads + writes
 * to Supabase when configured; falls back to localStorage when:
 *   - Supabase is not configured (e.g. self-hosted demo)
 *   - The user has no session (signed-out demo)
 *   - The network/server returns an error
 *
 * Public submit path (anonymous visitors filling /form/[slug]) uses the
 * anon client directly; the RLS policy `anyone can submit` enforces the
 * `accepts_submissions = true` invariant server-side.
 *
 * Schema (see docs/setup/migrations/forms_tables.sql):
 *   forms             (id, workbook_id, sheet_id, slug, name, description,
 *                      fields jsonb, accepts_submissions, created_by,
 *                      created_at, updated_at)
 *   form_submissions  (id, form_id, values jsonb, submitter_email,
 *                      submitted_at)
 */

import { getBrowserSupabase } from '@/lib/supabase/client'
import type { FormDefinition, FormField, FormSubmission } from '@/features/forms/types'

// ── localStorage fallback (legacy contract) ───────────────────────────────

const FORM_KEY = (id: string) => `quiksheets_form:${id}`
const INDEX_KEY = (workbookId: string) => `quiksheets_forms_index:${workbookId}`
const SUBMISSIONS_KEY = (id: string) => `quiksheets_form_submissions:${id}`
const SLUG_KEY = (slug: string) => `quiksheets_form_slug:${slug}`

interface StoredForm extends FormDefinition {
  id: string
  createdAt: number
}

interface StoredSubmissionLocal extends FormSubmission {
  submittedAt: number
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function inBrowser(): boolean {
  return typeof window !== 'undefined'
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'form'
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Local helpers (used as fallback) ──────────────────────────────────────

function saveFormLocal(form: FormDefinition): StoredForm {
  const id = form.id ?? crypto.randomUUID()
  const stored: StoredForm = { ...form, id, createdAt: Date.now() }
  localStorage.setItem(FORM_KEY(id), JSON.stringify(stored))
  localStorage.setItem(SLUG_KEY(stored.slug), id)
  const index = safeParse<string[]>(localStorage.getItem(INDEX_KEY(form.workbookId))) ?? []
  if (!index.includes(id)) {
    index.push(id)
    localStorage.setItem(INDEX_KEY(form.workbookId), JSON.stringify(index))
  }
  return stored
}

function getFormLocal(id: string): StoredForm | null {
  return safeParse<StoredForm>(localStorage.getItem(FORM_KEY(id)))
}

function getFormBySlugLocal(slug: string): StoredForm | null {
  if (!inBrowser()) return null
  const id = localStorage.getItem(SLUG_KEY(slug))
  if (id) {
    const direct = getFormLocal(id)
    if (direct) return direct
  }
  // Slow scan as a last resort (legacy stores didn't write SLUG_KEY).
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('quiksheets_form:')) continue
    const stored = safeParse<StoredForm>(localStorage.getItem(key))
    if (stored?.slug === slug) {
      // Backfill the slug index so the next lookup is O(1).
      localStorage.setItem(SLUG_KEY(slug), stored.id)
      return stored
    }
  }
  return null
}

function listFormsLocal(workbookId: string): StoredForm[] {
  const index = safeParse<string[]>(localStorage.getItem(INDEX_KEY(workbookId))) ?? []
  return index
    .map((id) => getFormLocal(id))
    .filter((f): f is StoredForm => f !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

function deleteFormLocal(id: string): void {
  const form = getFormLocal(id)
  localStorage.removeItem(FORM_KEY(id))
  localStorage.removeItem(SUBMISSIONS_KEY(id))
  if (form) {
    localStorage.removeItem(SLUG_KEY(form.slug))
    const index = safeParse<string[]>(localStorage.getItem(INDEX_KEY(form.workbookId))) ?? []
    const next = index.filter((x) => x !== id)
    localStorage.setItem(INDEX_KEY(form.workbookId), JSON.stringify(next))
  }
}

function appendSubmissionLocal(formId: string, submission: FormSubmission): string {
  const list = safeParse<StoredSubmissionLocal[]>(localStorage.getItem(SUBMISSIONS_KEY(formId))) ?? []
  const id = crypto.randomUUID()
  list.push({ ...submission, submittedAt: Date.now() })
  localStorage.setItem(SUBMISSIONS_KEY(formId), JSON.stringify(list))
  return id
}

function listSubmissionsLocal(formId: string): StoredSubmissionLocal[] {
  return safeParse<StoredSubmissionLocal[]>(localStorage.getItem(SUBMISSIONS_KEY(formId))) ?? []
}

function takeSubmissionsLocal(formId: string): StoredSubmissionLocal[] {
  const list = listSubmissionsLocal(formId)
  if (list.length > 0 && inBrowser()) {
    localStorage.removeItem(SUBMISSIONS_KEY(formId))
  }
  return list
}

// ── Supabase row mapping ──────────────────────────────────────────────────

interface FormRow {
  id: string
  workbook_id: string
  sheet_id: string
  name: string
  slug: string
  description: string | null
  fields: unknown
  accepts_submissions: boolean
  created_at: string
  updated_at?: string
}

function rowToForm(row: FormRow): FormDefinition {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    name: row.name,
    slug: row.slug,
    isPublic: Boolean(row.accepts_submissions),
    fields: (Array.isArray(row.fields) ? row.fields : []) as FormField[],
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export interface SubmittedSubmission {
  id: string
  formId: string
  values: Record<string, string | number | boolean>
  submitterEmail?: string | null
  submittedAt: string
}

/**
 * Load all forms for a given workbook. Visible to workbook members only.
 * Falls back to localStorage if Supabase isn't configured or the user
 * isn't signed in.
 */
export async function loadForms(workbookId: string): Promise<FormDefinition[]> {
  const supabase = getBrowserSupabase()
  if (!supabase || !inBrowser()) {
    return inBrowser() ? listFormsLocal(workbookId) : []
  }
  try {
    const { data, error } = await supabase
      .from('forms')
      .select('id, workbook_id, sheet_id, name, slug, description, fields, accepts_submissions, created_at, updated_at')
      .eq('workbook_id', workbookId)
      .order('created_at', { ascending: false })
    if (error || !data) {
      return listFormsLocal(workbookId)
    }
    return (data as FormRow[]).map(rowToForm)
  } catch {
    return listFormsLocal(workbookId)
  }
}

/**
 * Lookup a single form by slug. Used by the public form page.
 * Anonymous visitors can read because the RLS policy "public read by slug"
 * allows SELECT when `accepts_submissions = true`.
 */
export async function getFormBySlug(slug: string): Promise<FormDefinition | null> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('id, workbook_id, sheet_id, name, slug, description, fields, accepts_submissions, created_at, updated_at')
        .eq('slug', slug)
        .maybeSingle()
      if (!error && data) {
        return rowToForm(data as FormRow)
      }
    } catch {
      // fall through
    }
  }
  if (inBrowser()) {
    const local = getFormBySlugLocal(slug)
    return local ? (local as FormDefinition) : null
  }
  return null
}

/**
 * Lookup a single form by id.  Used by the legacy /form/[id] route which
 * still ships for back-compat with previously generated localStorage form
 * links.
 */
export async function getFormById(id: string): Promise<FormDefinition | null> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('id, workbook_id, sheet_id, name, slug, description, fields, accepts_submissions, created_at, updated_at')
        .eq('id', id)
        .maybeSingle()
      if (!error && data) {
        return rowToForm(data as FormRow)
      }
    } catch {
      // fall through
    }
  }
  if (inBrowser()) {
    const local = getFormLocal(id)
    return local ? (local as FormDefinition) : null
  }
  return null
}

export interface CreateFormInput {
  workbookId: string
  sheetId: string
  name: string
  fields: FormField[]
  description?: string
  acceptsSubmissions?: boolean
  slug?: string
}

/**
 * Create a new form. Returns the persisted record (with the server-assigned
 * id + the final slug). Falls back to localStorage on failure.
 */
export async function createForm(input: CreateFormInput): Promise<FormDefinition> {
  const slug = input.slug?.trim() || generateSlug(input.name)
  const acceptsSubmissions = input.acceptsSubmissions ?? true

  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const payload: Record<string, unknown> = {
          workbook_id: input.workbookId,
          sheet_id: input.sheetId,
          name: input.name.trim(),
          slug,
          fields: input.fields,
          accepts_submissions: acceptsSubmissions,
          created_by: user.id,
        }
        if (input.description !== undefined) payload.description = input.description
        const { data, error } = await supabase
          .from('forms')
          .insert(payload)
          .select('id, workbook_id, sheet_id, name, slug, description, fields, accepts_submissions, created_at, updated_at')
          .single()
        if (!error && data) {
          return rowToForm(data as FormRow)
        }
      }
    } catch {
      // fall through
    }
  }

  // Fallback path — write to localStorage so demo flows still work.
  const local = saveFormLocal({
    workbookId: input.workbookId,
    sheetId: input.sheetId,
    name: input.name.trim(),
    slug,
    isPublic: acceptsSubmissions,
    fields: input.fields,
  })
  return local
}

export interface UpdateFormInput {
  name?: string
  description?: string
  fields?: FormField[]
  acceptsSubmissions?: boolean
  slug?: string
}

export async function updateForm(id: string, updates: UpdateFormInput): Promise<void> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const payload: Record<string, unknown> = {}
      if (updates.name !== undefined) payload.name = updates.name.trim()
      if (updates.description !== undefined) payload.description = updates.description
      if (updates.fields !== undefined) payload.fields = updates.fields
      if (updates.acceptsSubmissions !== undefined) payload.accepts_submissions = updates.acceptsSubmissions
      if (updates.slug !== undefined) payload.slug = updates.slug
      if (Object.keys(payload).length === 0) return
      const { error } = await supabase.from('forms').update(payload).eq('id', id)
      if (!error) return
    } catch {
      // fall through
    }
  }

  if (!inBrowser()) return
  const local = getFormLocal(id)
  if (!local) return
  const next: StoredForm = {
    ...local,
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.fields !== undefined ? { fields: updates.fields } : {}),
    ...(updates.acceptsSubmissions !== undefined ? { isPublic: updates.acceptsSubmissions } : {}),
    ...(updates.slug !== undefined ? { slug: updates.slug } : {}),
  }
  localStorage.setItem(FORM_KEY(id), JSON.stringify(next))
  if (updates.slug && updates.slug !== local.slug) {
    localStorage.removeItem(SLUG_KEY(local.slug))
    localStorage.setItem(SLUG_KEY(updates.slug), id)
  }
}

export async function deleteForm(id: string): Promise<void> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const { error } = await supabase.from('forms').delete().eq('id', id)
      if (!error) {
        if (inBrowser()) deleteFormLocal(id)
        return
      }
    } catch {
      // fall through
    }
  }
  if (inBrowser()) deleteFormLocal(id)
}

/**
 * Submit a response to a public form. Runs against the anon client so
 * unauthenticated visitors can submit. The RLS policy `anyone can submit`
 * gates on `accepts_submissions = true`.
 */
export async function submitForm(
  slug: string,
  values: Record<string, string | number | boolean>,
  submitterEmail?: string,
): Promise<{ ok: boolean; id: string | null; error?: string }> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      // 1. Look up the form by slug. The "public read by slug" policy
      //    allows anon to do this.
      const { data: form, error: formErr } = await supabase
        .from('forms')
        .select('id, accepts_submissions')
        .eq('slug', slug)
        .maybeSingle()
      if (formErr || !form) {
        return { ok: false, id: null, error: 'Form not found' }
      }
      if (!form.accepts_submissions) {
        return { ok: false, id: null, error: 'Form is closed' }
      }
      // 2. Insert the submission.
      const insertPayload: Record<string, unknown> = {
        form_id: form.id,
        values,
      }
      if (submitterEmail) insertPayload.submitter_email = submitterEmail
      const { data, error } = await supabase
        .from('form_submissions')
        .insert(insertPayload)
        .select('id')
        .single()
      if (!error && data) {
        // Also append to local queue so the merge-into-sheet flow on the
        // workbook owner's next mount picks it up. The localStorage queue
        // doubles as the bridge from public submitter → workbook editor.
        if (inBrowser()) {
          appendSubmissionLocal(form.id as string, { formId: form.id as string, values })
        }
        return { ok: true, id: (data as { id: string }).id }
      }
    } catch {
      // fall through
    }
  }

  // Fallback — submit into localStorage (demo flow only).
  if (!inBrowser()) return { ok: false, id: null, error: 'No storage available' }
  const form = getFormBySlugLocal(slug)
  if (!form) return { ok: false, id: null, error: 'Form not found' }
  if (!form.isPublic) return { ok: false, id: null, error: 'Form is closed' }
  const id = appendSubmissionLocal(form.id, { formId: form.id, values })
  return { ok: true, id }
}

/**
 * List submissions for a form. Requires workbook membership (enforced by
 * the "members read submissions" RLS policy).
 */
export async function listSubmissions(formId: string): Promise<SubmittedSubmission[]> {
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('form_submissions')
        .select('id, form_id, values, submitter_email, submitted_at')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })
      if (!error && data) {
        return (data as Array<{
          id: string
          form_id: string
          values: Record<string, string | number | boolean>
          submitter_email: string | null
          submitted_at: string
        }>).map((row) => ({
          id: row.id,
          formId: row.form_id,
          values: row.values,
          submitterEmail: row.submitter_email,
          submittedAt: row.submitted_at,
        }))
      }
    } catch {
      // fall through
    }
  }
  if (!inBrowser()) return []
  const local = listSubmissionsLocal(formId)
  return local.map((sub, idx) => ({
    id: `local-${idx}`,
    formId: sub.formId,
    values: sub.values,
    submittedAt: new Date(sub.submittedAt).toISOString(),
  }))
}

/**
 * Read + clear all submissions for a form. Used by the workbook page on
 * mount to merge pending submissions into the sheet body. Uses the local
 * queue (not the Supabase table) so that even after submissions move to
 * Supabase, the workbook-merge bridge stays simple.
 */
export function takePendingSubmissions(formId: string): Array<{ values: Record<string, string | number | boolean> }> {
  if (!inBrowser()) return []
  return takeSubmissionsLocal(formId).map((s) => ({ values: s.values }))
}

// ── localStorage → Supabase one-time migration ────────────────────────────

const MIGRATION_DONE_KEY = 'quiksheets_forms_migrated_to_supabase'

/**
 * On first load with a signed-in user, look for any locally-stored
 * `quiksheets_form:*` entries and upsert them into Supabase, then delete
 * the locals so we don't double-import on the next session.
 *
 * Returns the number of forms migrated. Safe to call any time — the
 * migration flag prevents re-running.
 */
export async function migrateLocalFormsToSupabase(): Promise<number> {
  if (!inBrowser()) return 0
  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return 0

  const supabase = getBrowserSupabase()
  if (!supabase) return 0

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    // Collect all local forms across all workbook indexes.
    const allLocalForms: StoredForm[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('quiksheets_form:')) continue
      const stored = safeParse<StoredForm>(localStorage.getItem(key))
      if (stored?.id && stored.workbookId && stored.slug) allLocalForms.push(stored)
    }
    if (allLocalForms.length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, 'true')
      return 0
    }

    // Upsert each form by slug (unique).
    let migrated = 0
    for (const form of allLocalForms) {
      const payload = {
        id: form.id,
        workbook_id: form.workbookId,
        sheet_id: form.sheetId,
        name: form.name,
        slug: form.slug,
        fields: form.fields,
        accepts_submissions: form.isPublic !== false,
        created_by: user.id,
      }
      try {
        const { error } = await supabase
          .from('forms')
          .upsert(payload, { onConflict: 'slug' })
        if (!error) migrated++
      } catch {
        // skip this form; continue migrating others
      }
    }

    // Clean up locals (forms + indexes + slug map). Leave the submissions
    // queue alone — they'll be merged into the sheet on the next mount and
    // then removed by takePendingSubmissions().
    if (migrated > 0) {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (
          key.startsWith('quiksheets_form:') ||
          key.startsWith('quiksheets_forms_index:') ||
          key.startsWith('quiksheets_form_slug:')
        ) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) localStorage.removeItem(key)
    }

    localStorage.setItem(MIGRATION_DONE_KEY, 'true')
    return migrated
  } catch {
    return 0
  }
}

// ── Public helpers (re-exported for back-compat with legacy callers) ──────
export { generateSlug }
