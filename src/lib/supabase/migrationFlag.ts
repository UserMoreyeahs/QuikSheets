'use client'

/**
 * Per-workbook (or per-anything) one-time-migration flag in localStorage.
 *
 * Used by the Supabase persistence APIs to gate the "lift local-only rows
 * up to Supabase on first authenticated load" step so it runs at most once
 * per (prefix, id) pair.
 *
 * Convention:
 *   - flag stored as the literal string `"true"` at key `${prefix}:${id}`
 *   - `has()` returns `true` in SSR (assume already-migrated so the
 *      hydration path never tries to write)
 *   - `mark()` is a no-op in SSR
 *
 * Consolidates the `migratedFlagKey`/`hasMigrated*`/`markMigrated*`
 * triple previously copy-pasted across six API files.
 */
export interface MigrationFlag {
  has: (id: string) => boolean
  mark: (id: string) => void
}

export function createMigrationFlag(prefix: string): MigrationFlag {
  const keyFor = (id: string) => `${prefix}:${id}`
  return {
    has: (id) => {
      if (typeof window === 'undefined') return true
      return window.localStorage.getItem(keyFor(id)) === 'true'
    },
    mark: (id) => {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(keyFor(id), 'true')
    },
  }
}
