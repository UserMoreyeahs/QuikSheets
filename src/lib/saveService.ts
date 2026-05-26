/**
 * saveService — the canonical workbook-save path.
 *
 * Behavior:
 *   1. If Supabase is configured AND the user has a session, POST the
 *      payload to /api/sheet (which authorises via owner OR editor
 *      membership in sheetApi.ts).
 *   2. If that fails OR the user is unauthenticated OR Supabase is not
 *      configured, fall back to localStorage so unauth/demo flows
 *      still feel save-y.
 *
 * Returns the workbook id from the server when the server save
 * succeeds — the caller pins this id so subsequent saves UPDATE
 * instead of INSERT.
 *
 * Before this rewrite, this file was a localStorage-only legacy save
 * service. The MVP T012 test ("Edit auto-saves; second user sees the
 * change") was therefore silently broken because nothing ever went to
 * Supabase.
 */

import { getBrowserSupabase } from './supabase/client'

export interface WorkbookSaveData {
  id?: string
  name: string
  data: unknown
}

export interface SaveResult {
  id: string | null
  /** Where the save ended up. Useful for UI affordances ("Saved (offline)"). */
  destination: 'supabase' | 'localStorage'
  /** Optional error message; only set when destination is 'localStorage' due to a fall-back. */
  fallbackReason?: string
}

function localStorageKey(name: string): string {
  return `quiksheets_workbook_${name}`
}

function persistLocally(payload: WorkbookSaveData): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      localStorageKey(payload.name),
      JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
    )
  } catch {
    // localStorage may throw QuotaExceededError; silently degrade so a
    // failed save doesn't pop the Next.js dev error overlay on every edit.
  }
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Save the workbook. Tries Supabase first; falls back to localStorage
 * if the user is unauthenticated, Supabase is not configured, or the
 * server returns a non-2xx response.
 */
export async function saveWorkbook(payload: WorkbookSaveData): Promise<SaveResult> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    persistLocally(payload)
    return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: 'no session' }
  }

  try {
    const res = await fetch('/api/sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      // Persist locally so the user doesn't lose their work; surface
      // a reason the caller can show in the SaveStatus chip.
      persistLocally(payload)
      const reason = `${res.status} ${res.statusText}`
      return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: reason }
    }
    const json = await res.json() as { id?: string }
    return { id: json.id ?? payload.id ?? null, destination: 'supabase' }
  } catch (err) {
    // Network error → persist locally and surface the reason.
    persistLocally(payload)
    const reason = err instanceof Error ? err.message : 'network error'
    return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: reason }
  }
}

export async function loadWorkbook(name: string): Promise<WorkbookSaveData | null> {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(localStorageKey(name))
    if (!raw) return null
    return JSON.parse(raw) as WorkbookSaveData
  } catch {
    return null
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Auto-save with a 30s debounce. Multiple calls collapse to one save.
 * Fires Ctrl+S equivalents immediately via `saveWorkbook(payload)`.
 */
export function debouncedSave(payload: WorkbookSaveData): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    void saveWorkbook(payload)
  }, 30_000)
}
