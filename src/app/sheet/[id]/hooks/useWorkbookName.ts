'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const KEY = (workbookId: string) => `quiksheets_workbook_name:${workbookId}`

/** Default-name derivation matches the original inline useState initialiser. */
function defaultName(workbookId: string): string {
  return workbookId === 'demo'
    ? 'Demo Spreadsheet'
    : `Workbook ${workbookId.slice(0, 8)}`
}

/**
 * Two-way binding between the user-facing workbook name and its
 * localStorage backing key:
 *
 *   1. Initial state: a stable default derived from workbookId, so the
 *      first render is SSR-safe (no localStorage access).
 *   2. On mount: if localStorage has a saved name, load it.
 *   3. On state change: persist to localStorage so it survives reloads.
 *
 * Returns `[workbookName, setWorkbookName]`, the same signature as the
 * original useState. localStorage is best-effort — failures (quota,
 * private mode) are swallowed; the in-memory name remains usable.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useWorkbookName(
  workbookId: string,
): [string, Dispatch<SetStateAction<string>>] {
  const [name, setName] = useState(() => defaultName(workbookId))

  // Load saved name from localStorage on workbookId change.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY(workbookId))
      if (stored?.trim()) setName(stored)
    } catch {
      // localStorage optional; in-memory name remains usable.
    }
  }, [workbookId])

  // Persist on change so it survives reloads.
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY(workbookId), name)
    } catch {
      // Saves still proceed through SaveStatus regardless.
    }
  }, [workbookId, name])

  return [name, setName]
}
