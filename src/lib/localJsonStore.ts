'use client'

/**
 * Generic JSON-backed localStorage helper for per-id caches.
 *
 * All operations are guarded for SSR and swallow runtime errors
 * (quota exceeded, private-mode blocks, malformed cached JSON) so the
 * caller never has to handle storage being unavailable — Supabase
 * remains the source of truth and the local cache is best-effort.
 *
 * Keys are built as `${keyPrefix}:${id}`.
 *
 * Consolidates the `readLocal*`/`writeLocal*`/`clearLocal*` triple
 * previously copy-pasted across cfRulesApi, columnTypesApi, and inlined
 * in versionsApi / shareLinksApi / notificationsApi.
 */
export interface LocalJsonStore<T> {
  read: (id: string) => T | null
  write: (id: string, value: T) => void
  clear: (id: string) => void
}

export function makeLocalStore<T>(keyPrefix: string): LocalJsonStore<T> {
  const keyFor = (id: string) => `${keyPrefix}:${id}`
  return {
    read: (id) => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem(keyFor(id))
        return raw ? (JSON.parse(raw) as T) : null
      } catch {
        return null
      }
    },
    write: (id, value) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(keyFor(id), JSON.stringify(value))
      } catch {
        // Quota / privacy mode — silently skip; Supabase keeps truth.
      }
    },
    clear: (id) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.removeItem(keyFor(id))
      } catch {
        // ignore
      }
    },
  }
}
