'use client'

import { useEffect } from 'react'
import type { Sheet } from '@fortune-sheet/core'
import { useSheetStore } from '@/store/sheetStore'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { loadWorkbookData } from '@/lib/saveService'

/**
 * Restore a workbook's SAVED cell data when the sheet page opens.
 *
 * This is the read side of persistence. Without it, edits were saved
 * (localStorage / Supabase) but NEVER loaded back — so reopening a
 * workbook showed an empty grid and all work appeared lost. (The other
 * mount hooks only load template seed data, CF rules, automations, and
 * the name — never the grid cells.)
 *
 * Order of resolution:
 *   1. If a `quiksheets_template_data:<id>` key exists, this is a brand-new
 *      workbook still carrying its seed — let useLoadTemplateDataOnMount
 *      own it and do nothing here (avoids a double-hydration race).
 *   2. Authenticated + Supabase configured → GET /api/sheet?id=<id>. If the
 *      server returns a workbook with sheet data, hydrate from it.
 *   3. Otherwise (or on any miss) → load the localStorage fallback by id
 *      (loadWorkbookData), which is what local/offline/demo workbooks use.
 *
 * Hydration uses replaceGridSheets (bumps hydrationVersion → FortuneSheet
 * remounts and re-reads), the same path import/template use.
 *
 * Single-shot on mount; workbookId/name captured by closure intentionally.
 */
export function useLoadWorkbookDataOnMount(
  workbookId: string,
  workbookName: string,
): void {
  useEffect(() => {
    if (!workbookId) return

    let cancelled = false

    void (async () => {
      // 1. Brand-new seeded workbook — template hook owns hydration.
      try {
        if (typeof window !== 'undefined' &&
            window.localStorage.getItem(`quiksheets_template_data:${workbookId}`)) {
          return
        }
      } catch {
        // localStorage unavailable; fall through to the load attempts.
      }

      // Use the PERSISTED name (useWorkbookName loads it into state only
      // after mount, so the closure's workbookName may still be the
      // derived default). The persisted name makes the name-key fallback
      // accurate for data saved before id-keying existed.
      let effectiveName = workbookName
      try {
        const stored = window.localStorage.getItem(`quiksheets_workbook_name:${workbookId}`)
        if (stored?.trim()) effectiveName = stored
      } catch {
        // localStorage optional — fall back to the closure name.
      }

      const sheets = await resolveSavedSheets(workbookId, effectiveName)
      if (cancelled || !sheets || sheets.length === 0) return

      // Only replace if the grid is still on the untouched default. If the
      // user already started editing (or another hook hydrated) in the
      // brief async window, don't clobber their in-progress state.
      const state = useSheetStore.getState()
      const current = state.gridSheets
      const currentIsPristineDefault =
        current.length <= 1 &&
        (current[0]?.celldata?.length ?? 0) === 0 &&
        !current[0]?.data?.some?.((row) => row?.some?.((cell) => cell != null))
      if (!currentIsPristineDefault) return

      state.replaceGridSheets(sheets)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/**
 * Resolve the saved sheets for a workbook: Supabase first when authed,
 * then the localStorage fallback. Returns null when nothing is found.
 */
async function resolveSavedSheets(
  workbookId: string,
  workbookName: string,
): Promise<Sheet[] | null> {
  // ── Supabase (authenticated) ──────────────────────────────────────
  const supabase = getBrowserSupabase()
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) {
        const res = await fetch(`/api/sheet?id=${encodeURIComponent(workbookId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = (await res.json()) as { workbook?: { data?: unknown } }
          const remote = extractSheets(json.workbook?.data)
          if (remote) return remote
        }
        // Non-2xx (404 for a local wb_ id, 403, …) → fall through to local.
      }
    } catch {
      // Network/parse error → fall through to local.
    }
  }

  // ── localStorage fallback (local / offline / demo) ────────────────
  const local = await loadWorkbookData({ id: workbookId, name: workbookName })
  return extractSheets(local?.data)
}

/** Coerce an unknown saved `data` blob into a non-empty Sheet[] or null. */
function extractSheets(data: unknown): Sheet[] | null {
  if (Array.isArray(data) && data.length > 0) return data as Sheet[]
  return null
}
