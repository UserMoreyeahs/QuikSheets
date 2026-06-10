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
  /**
   * True when the server rejected the save with 409 because someone else
   * saved this workbook first. The local copy is preserved (no data lost);
   * the UI should prompt the user to reload and re-apply their change.
   */
  conflict?: boolean
}

/**
 * Optimistic-concurrency versions: workbook id → the `updated_at` we last
 * loaded/saved. Sent as `baseUpdatedAt` so the server can reject a stale
 * write (409) instead of silently clobbering a concurrent edit. Populated
 * by the load path via `noteWorkbookVersion` and refreshed on each save.
 */
const _workbookVersions: Record<string, string> = {}

/** Record the server `updated_at` for a workbook (called after a load/save). */
export function noteWorkbookVersion(
  id: string | null | undefined,
  updatedAt: string | null | undefined,
): void {
  if (id && updatedAt) _workbookVersions[id] = updatedAt
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
/**
 * Last user id seen by getAuthContext. Cached so the SYNCHRONOUS unload
 * flush (flushPendingSave) can key localStorage under the right user
 * segment without an async getSession() it has no time to await.
 */
let _lastKnownUserId: string | null = null

/**
 * Resolve (and cache) the auth context once, without saving anything.
 * The sheet page calls this on mount so `_lastKnownUserId` is primed for the
 * SYNCHRONOUS unload flush — otherwise a refresh that hydrated from the
 * server (where loadWorkbookData never runs) left it null, and an early tab
 * close keyed the flushed blob under 'anon' while the loader reads the
 * '<userId>' segment ("data gone after refresh").
 */
export async function primeAuthContext(): Promise<void> {
  await getAuthContext()
}

async function getAuthContext(): Promise<AuthContext> {
  const supabase = getBrowserSupabase()
  if (!supabase) return { accessToken: null, userId: null }
  try {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    _lastKnownUserId = session?.user?.id ?? _lastKnownUserId
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
export async function saveWorkbook(
  payload: WorkbookSaveData,
  options?: { isRetry?: boolean },
): Promise<SaveResult> {
  const { accessToken, userId } = await getAuthContext()
  if (!accessToken) {
    persistLocally(payload, userId)
    return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: 'no session' }
  }

  try {
    // Attach the optimistic-concurrency token when we have one for this
    // workbook, so the server can reject a stale write instead of
    // overwriting a concurrent edit.
    const baseUpdatedAt = payload.id ? _workbookVersions[payload.id] : undefined
    const res = await fetch('/api/sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(baseUpdatedAt ? { ...payload, baseUpdatedAt } : payload),
    })
    if (res.status === 409) {
      // Optimistic-concurrency conflict: the row's updated_at moved since we
      // last synced. The 409 body carries the server's CURRENT updated_at —
      // adopt it so we stop looping on a stale base, then retry the save ONCE
      // with the fresh base (last-writer-wins).
      //
      // Without this, a single conflict wedged the client into a PERMANENT
      // 409 loop: every later autosave re-sent the same stale baseUpdatedAt,
      // so the user's edits never persisted and only a full reload — which
      // discards them — "recovered". (Trade-off: after a genuine concurrent
      // edit by another session this resolves last-writer-wins, which is the
      // expected model for this app and strictly better than losing the
      // active user's work.)
      let currentUpdatedAt: string | undefined
      try {
        const body = (await res.json()) as { currentUpdatedAt?: string }
        currentUpdatedAt = body.currentUpdatedAt ?? undefined
      } catch {
        // Body wasn't JSON / already consumed — fall through to conflict.
      }
      if (payload.id && !options?.isRetry) {
        if (currentUpdatedAt) {
          // Adopt the server's current version, then retry with a correct base.
          noteWorkbookVersion(payload.id, currentUpdatedAt)
        } else {
          // Conflict with NO usable server version (currentUpdatedAt was null —
          // sheetApi sends `?? null` — or the body wasn't JSON). Drop the stale
          // base so the retry sends no baseUpdatedAt → the server does an
          // unconditional last-writer-wins update instead of looping forever on
          // a base we can never advance. Without this, the user stays wedged on
          // "Edited elsewhere" and edits never persist.
          delete _workbookVersions[payload.id]
        }
        return saveWorkbook(payload, { isRetry: true })
      }
      // The retry also conflicted (rapid concurrent edits), or we couldn't
      // read the server version — keep the work locally and surface it.
      persistLocally(payload, userId)
      return {
        id: payload.id ?? null,
        destination: 'localStorage',
        fallbackReason: 'conflict',
        conflict: true,
      }
    }
    if (!res.ok) {
      // Persist locally so the user doesn't lose their work; surface
      // a reason the caller can show in the SaveStatus chip.
      persistLocally(payload, userId)
      const reason = `${res.status} ${res.statusText}`
      return { id: payload.id ?? null, destination: 'localStorage', fallbackReason: reason }
    }
    const json = await res.json() as { id?: string; updatedAt?: string }
    // Refresh our version token so the NEXT save's base matches the row.
    noteWorkbookVersion(json.id ?? payload.id, json.updatedAt)
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
/**
 * Load a workbook's saved payload from the localStorage fallback.
 *
 * Reads in priority order, mirroring how `saveWorkbook` writes:
 *   1. the id-scoped key   `…:<user>:id:<id>`     (when an id is given)
 *   2. the name-scoped key `…:<user>:name:<slug>` (current name-based)
 *   3. the legacy key      `quiksheets_workbook_<name>` (pre-isolation)
 * On a legacy/name hit it re-homes the blob under the id key (if an id is
 * available) so subsequent loads are a clean hit and stop colliding with
 * other same-named workbooks.
 *
 * This is what makes edits survive a reopen for LOCAL (non-Supabase)
 * workbooks. Supabase workbooks are loaded server-side via GET /api/sheet.
 */
export async function loadWorkbookData(
  opts: { id?: string; name: string },
): Promise<WorkbookSaveData | null> {
  try {
    if (typeof window === 'undefined') return null
    const { userId } = await getAuthContext()
    const idKey = opts.id ? localStorageKey({ id: opts.id, name: opts.name }, userId) : null
    const nameKey = localStorageKey({ name: opts.name }, userId)

    // 1. id-scoped (the unique, collision-free key).
    if (idKey) {
      const hit = window.localStorage.getItem(idKey)
      if (hit) return JSON.parse(hit) as WorkbookSaveData
    }

    // 1b. id-scoped under ANY user segment. Saver and loader resolve the
    // session independently, so the same workbook can end up written under
    // ':anon:' (auth not yet resolved / unload flush) while the loader reads
    // ':<userId>:' — making saved data look gone after a refresh. Workbook
    // ids are globally unique, so a cross-segment id hit can only be this
    // workbook; re-home it under the current segment.
    if (opts.id && idKey) {
      const suffix = `:id:${opts.id}`
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (!key || !key.startsWith(`${KEY_PREFIX}:`) || !key.endsWith(suffix)) continue
        const hit = window.localStorage.getItem(key)
        if (!hit) continue
        try {
          window.localStorage.setItem(idKey, hit) // re-home for clean future reads
        } catch {
          /* best-effort */
        }
        return JSON.parse(hit) as WorkbookSaveData
      }
    }

    // 2. name-scoped, then 3. legacy — but NEVER serve the legacy
    // (pre-isolation, user-UNSCOPED) blob to an authenticated user: on a
    // shared browser it could be a different person's data.
    const nameHit = window.localStorage.getItem(nameKey)
    const legacyKey = legacyLocalStorageKey(opts.name)
    const legacyHit = nameHit || userId !== null ? null : window.localStorage.getItem(legacyKey)
    const raw = nameHit ?? legacyHit
    if (!raw) return null

    const parsed = JSON.parse(raw) as WorkbookSaveData
    // Migrate forward to the MOST specific key available (id beats name) so
    // the next read is a clean hit and same-named workbooks stop colliding.
    const targetKey = idKey ?? nameKey
    const readFromKey = nameHit ? nameKey : legacyKey
    if (targetKey !== readFromKey) {
      try {
        window.localStorage.setItem(targetKey, raw)
      } catch {
        // Re-home is best-effort; we still return what we read.
      }
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Back-compat shim: load by name only. Delegates to {@link loadWorkbookData}.
 * Prefer `loadWorkbookData({ id, name })` so id-scoped saves are found.
 */
export async function loadWorkbook(name: string): Promise<WorkbookSaveData | null> {
  return loadWorkbookData({ name })
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _pendingPayload: WorkbookSaveData | null = null
let _pendingOnResult: ((result: SaveResult) => void) | null = null

/**
 * Auto-save debounce window. 2s (was 30s). 30s meant a user who typed and
 * then closed the tab / navigated within half a minute saved NOTHING and
 * lost their work. 2s still batches rapid keystrokes but persists almost
 * immediately after a pause — and `flushPendingSave` covers the exit case.
 */
const AUTOSAVE_DEBOUNCE_MS = 2_000

/**
 * Auto-save with a short debounce. Multiple calls collapse to one save.
 * The latest payload is retained so {@link flushPendingSave} can persist it
 * immediately on navigation / tab close.
 */
export function debouncedSave(
  payload: WorkbookSaveData,
  onResult?: (result: SaveResult) => void,
): void {
  _pendingPayload = payload
  _pendingOnResult = onResult ?? null
  if (_saveTimer !== null) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    const p = _pendingPayload
    const cb = _pendingOnResult
    _pendingPayload = null
    _pendingOnResult = null
    // Report the result so the SaveStatus UI can flip to "Saved"/"conflict"
    // instead of being stuck on "Unsaved changes" (the autosave used to be
    // fire-and-forget, so a successful save never updated the indicator).
    if (p) void saveWorkbook(p).then((result) => cb?.(result))
  }, AUTOSAVE_DEBOUNCE_MS)
}

/**
 * Flush any pending debounced save NOW. Call on route change / tab close so
 * the last edits aren't stranded in the debounce window. Synchronously
 * mirrors to localStorage first (survives an unload that kills the async
 * fetch), then best-effort attempts the full save.
 */
export function flushPendingSave(): void {
  if (_saveTimer !== null) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
  const p = _pendingPayload
  const cb = _pendingOnResult
  _pendingPayload = null
  _pendingOnResult = null
  if (!p) return
  // Synchronous local mirror — guaranteed to land even during unload.
  // Use the last-known user id so the key matches what the load path reads
  // (the async getSession() can't complete during unload).
  persistLocally(p, _lastKnownUserId)
  void saveWorkbook(p).then((result) => cb?.(result))
}
