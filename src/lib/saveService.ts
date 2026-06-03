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
 *
 * Data-isolation note (this revision):
 *   The localStorage fallback used to be keyed purely by workbook NAME
 *   (`quiksheets_workbook_${name}`). Two workbooks both named
 *   "Budget.xlsx" collided, and on a shared device one user's offline
 *   data could surface for another. The fallback is now keyed by
 *   workbook IDENTITY (the workbook id when present) AND, when a
 *   Supabase user id is cheaply available, by user. See
 *   `localStorageKey` and `loadWorkbook` (which performs a one-release
 *   backward-compatible migration off the old name-based key).
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

/** Auth context resolved from a SINGLE getSession() call — see getAuthContext. */
interface AuthContext {
  accessToken: string | null
  /** Supabase user id when available; used to scope the localStorage key per user. */
  userId: string | null
}

/** Marker prefix shared by both the new and (transitively) the legacy keys. */
const KEY_PREFIX = 'quiksheets_workbook'

/** Segment used when no Supabase user id is available (unauth/demo/offline). */
const ANON_SEGMENT = 'anon'

/**
 * Stable, collision-resistant slug for a workbook name. Used ONLY as the
 * identity segment when no workbook id is present yet (e.g. a brand-new
 * unsaved workbook). Lower-cases, replaces any run of non-alphanumerics
 * with a single '-', and trims leading/trailing '-'. An empty result
 * (e.g. name was all punctuation) collapses to 'untitled' so the key is
 * always well-formed.
 */
function slug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.length > 0 ? s : 'untitled'
}

/**
 * The legacy (pre-isolation) localStorage key. Kept only so `loadWorkbook`
 * can migrate data written by older builds. Do NOT write new entries here.
 */
function legacyLocalStorageKey(name: string): string {
  return `${KEY_PREFIX}_${name}`
}

/**
 * The current localStorage key. Scoped by user (when known) and by
 * workbook identity:
 *   - With a workbook id:   quiksheets_workbook:<user>:id:<id>
 *   - Without a workbook id: quiksheets_workbook:<user>:name:<slug(name)>
 *
 * The `id:` / `name:` discriminator keeps id-keyed and name-keyed entries
 * in disjoint namespaces, so `loadWorkbook` (which only receives a name)
 * can always reconstruct the exact name-based key it needs.
 */
function localStorageKey(payload: { id?: string; name: string }, userId: string | null): string {
  const userSeg = userId ?? ANON_SEGMENT
  const idSeg = payload.id ? `id:${payload.id}` : `name:${slug(payload.name)}`
  return `${KEY_PREFIX}:${userSeg}:${idSeg}`
}

function persistLocally(payload: WorkbookSaveData, userId: string | null): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      localStorageKey(payload, userId),
      JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
    )
  } catch {
    // localStorage may throw QuotaExceededError; silently degrade so a
    // failed save doesn't pop the Next.js dev error overlay on every edit.
  }
}

/**
 * Resolve the Supabase access token AND user id from a SINGLE
 * `getSession()` call. The session object already carries `user`, so we
 * get the id for free — no second (slow) `auth.getUser()` round-trip on
 * the save hot path.
 *
 * When Supabase is unconfigured, the session is absent, or the call
 * throws, both fields are null and the caller scopes the key by the
 * 'anon' segment.
 */
async function getAuthContext(): Promise<AuthContext> {
  const supabase = getBrowserSupabase()
  if (!supabase) return { accessToken: null, userId: null }
  try {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    return {
      accessToken: session?.access_token ?? null,
      userId: session?.user?.id ?? null,
    }
  } catch {
    return { accessToken: null, userId: null }
  }
}

/**
 * Save the workbook. Tries Supabase first; falls back to localStorage
 * if the user is unauthenticated, Supabase is not configured, or the
 * server returns a non-2xx response.
 */
export async function saveWorkbook(payload: WorkbookSaveData): Promise<SaveResult> {
  const { accessToken, userId } = await getAuthContext()
  if (!accessToken) {
    persistLocally(payload, userId)
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
      persistLocally(payload, userId)
      const reason = `${res.status} ${res.statusText}`
      return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: reason }
    }
    const json = await res.json() as { id?: string }
    return { id: json.id ?? payload.id ?? null, destination: 'supabase' }
  } catch (err) {
    // Network error → persist locally and surface the reason.
    persistLocally(payload, userId)
    const reason = err instanceof Error ? err.message : 'network error'
    return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: reason }
  }
}

/**
 * Load a workbook from the localStorage fallback by name.
 *
 * Migration (one release, backward-compatible): we first try the current
 * name-scoped key. If nothing is there, we try the legacy
 * `quiksheets_workbook_${name}` key; if found, we re-write it under the
 * current key (so the next read is a clean hit) and return it. Old
 * entries are left in place — a future release can sweep them.
 *
 * NOTE: callers only have the workbook name here, so this addresses the
 * NAME-scoped key (the id-scoped entries written by `saveWorkbook` when an
 * id is present are looked up server-side via /api/sheet, not here).
 */
export async function loadWorkbook(name: string): Promise<WorkbookSaveData | null> {
  try {
    if (typeof window === 'undefined') return null
    const { userId } = await getAuthContext()
    const newKey = localStorageKey({ name }, userId)

    const fresh = window.localStorage.getItem(newKey)
    if (fresh) return JSON.parse(fresh) as WorkbookSaveData

    // Backward-compatible migration off the old name-based key.
    const legacy = window.localStorage.getItem(legacyLocalStorageKey(name))
    if (!legacy) return null

    const parsed = JSON.parse(legacy) as WorkbookSaveData
    // Re-home under the new key so subsequent loads hit the fast path.
    try {
      window.localStorage.setItem(newKey, legacy)
    } catch {
      // Quota/serialization issue on the rewrite is non-fatal: we still
      // return the data we successfully read from the legacy key.
    }
    return parsed
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
