'use client'

/**
 * localStorage-backed forms store — lets us run the Forms feature without
 * Supabase set up.  Forms are stored per-form (keyed by id) so the public
 * /form/[id] route can read them with no extra plumbing.
 */

import type { FormDefinition, FormSubmission } from '@/features/forms/types'

const FORM_KEY = (id: string) => `sheetforge_form:${id}`
const INDEX_KEY = (workbookId: string) => `sheetforge_forms_index:${workbookId}`
const SUBMISSIONS_KEY = (id: string) => `sheetforge_form_submissions:${id}`

type StoredForm = FormDefinition & { id: string; createdAt: number }

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export function saveForm(form: FormDefinition): StoredForm {
  if (typeof window === 'undefined') throw new Error('saveForm must be called in browser')
  const id = form.id ?? crypto.randomUUID()
  const stored: StoredForm = { ...form, id, createdAt: Date.now() }
  localStorage.setItem(FORM_KEY(id), JSON.stringify(stored))

  // maintain a per-workbook index so we can list all forms later
  const index = safeParse<string[]>(localStorage.getItem(INDEX_KEY(form.workbookId))) ?? []
  if (!index.includes(id)) {
    index.push(id)
    localStorage.setItem(INDEX_KEY(form.workbookId), JSON.stringify(index))
  }
  return stored
}

export function getForm(id: string): StoredForm | null {
  if (typeof window === 'undefined') return null
  return safeParse<StoredForm>(localStorage.getItem(FORM_KEY(id)))
}

export function listFormsForWorkbook(workbookId: string): StoredForm[] {
  if (typeof window === 'undefined') return []
  const index = safeParse<string[]>(localStorage.getItem(INDEX_KEY(workbookId))) ?? []
  return index
    .map((id) => getForm(id))
    .filter((f): f is StoredForm => f !== null)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function deleteForm(id: string): void {
  if (typeof window === 'undefined') return
  const form = getForm(id)
  localStorage.removeItem(FORM_KEY(id))
  localStorage.removeItem(SUBMISSIONS_KEY(id))
  if (form) {
    const index = safeParse<string[]>(localStorage.getItem(INDEX_KEY(form.workbookId))) ?? []
    const next = index.filter((x) => x !== id)
    localStorage.setItem(INDEX_KEY(form.workbookId), JSON.stringify(next))
  }
}

// ── Submissions ────────────────────────────────────────────────────────

interface StoredSubmission extends FormSubmission {
  submittedAt: number
}

export function appendSubmission(formId: string, submission: FormSubmission): void {
  if (typeof window === 'undefined') return
  const list = safeParse<StoredSubmission[]>(localStorage.getItem(SUBMISSIONS_KEY(formId))) ?? []
  list.push({ ...submission, submittedAt: Date.now() })
  localStorage.setItem(SUBMISSIONS_KEY(formId), JSON.stringify(list))
}

export function listSubmissions(formId: string): StoredSubmission[] {
  if (typeof window === 'undefined') return []
  return safeParse<StoredSubmission[]>(localStorage.getItem(SUBMISSIONS_KEY(formId))) ?? []
}

/**
 * Read & clear all submissions for a form — caller is responsible for
 * appending the values to the workbook sheet.
 */
export function takeSubmissions(formId: string): StoredSubmission[] {
  const list = listSubmissions(formId)
  if (list.length > 0 && typeof window !== 'undefined') {
    localStorage.removeItem(SUBMISSIONS_KEY(formId))
  }
  return list
}
