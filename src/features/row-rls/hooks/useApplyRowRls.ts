'use client'

/**
 * useApplyRowRls — orchestrator-mountable hook that applies Row RLS rules.
 *
 * Mount this hook in `src/app/sheet/[id]/page.tsx` (or its hooks barrel)
 * alongside `useApplyCFOnMount`. It reads the current user's role/identity,
 * evaluates the active sheet's Row RLS rules via `evaluateRules`, and writes
 * the resulting hidden-row set to `sheetStore.setOutlineHiddenRows`.
 *
 * Integration instructions for the orchestrator:
 * ─────────────────────────────────────────────
 * 1. Import the hook:
 *      import { useApplyRowRls } from '@/features/row-rls'
 *
 * 2. Mount it inside the sheet page component, passing the workbook ID:
 *      useApplyRowRls(workbookId, userRole, userId, userEmail)
 *
 *    Where:
 *      workbookId — the URL param `id` (string)
 *      userRole   — 'owner' | 'editor' | 'viewer' | null
 *      userId     — Supabase user.id or null
 *      userEmail  — user.email or null
 *
 *    These values are already available in page.tsx from the Supabase session
 *    and the workbook record's owner_id / workbook_members lookup.
 *
 * 3. Load rules once on mount (if not already loading via cfOnMount pattern):
 *    The hook calls `useRowRlsStore.loadRules(workbookId)` internally.
 *
 * 4. The hook re-runs whenever `rules`, `activeSheetId`, or the matrix change.
 *
 * Hidden-rows integration:
 * ─────────────────────────
 * The hidden rows are written via `setOutlineHiddenRows(sheetId, rowArray)`.
 * This is the same mechanism used by the Outline (Group/Ungroup) feature —
 * FortuneSheet's `config.rowhidden` is the authoritative source rendered
 * by the grid, and sheetStore unions all sources of hidden rows before
 * writing to it.  Row RLS therefore works alongside filter-hidden rows and
 * outline-hidden rows without any conflict.
 */

import { useEffect, useRef } from 'react'
import { useWorkbookStore } from '@/store/workbookStore'
import { useSheetStore } from '@/store/sheetStore'
import { useRowRlsStore } from '../store/rowRlsStore'
import { evaluateRules } from '../utils/rowRlsEvaluator'
import { getSheetMatrix } from '@/lib/fortuneSheet'

/**
 * @param workbookId  - UUID of the current workbook.
 * @param userRole    - Current user's role ('owner' | 'editor' | 'viewer' | null).
 * @param userId      - Current Supabase user ID, or null.
 * @param userEmail   - Current user email, or null.
 */
export function useApplyRowRls(
  workbookId: string,
  userRole: 'owner' | 'editor' | 'viewer' | null,
  userId: string | null,
  userEmail: string | null
): void {
  const { activeSheetId } = useWorkbookStore()
  const { gridSheets, setOutlineHiddenRows } = useSheetStore()
  const { rules, loadRules } = useRowRlsStore()

  // Load rules once on mount (no-op if already loaded for this workbook).
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (loadedFor.current === workbookId) return
    loadedFor.current = workbookId
    void loadRules(workbookId)
  }, [workbookId, loadRules])

  // Re-apply whenever rules, active sheet, or grid data changes.
  useEffect(() => {
    const sheetRules = rules[activeSheetId] ?? []

    // Find the active sheet matrix.
    const sheet = gridSheets.find((s) => s.id === activeSheetId)
    if (!sheet) return

    const matrix = getSheetMatrix(sheet)
    const hiddenSet = evaluateRules(sheetRules, userRole, userId, userEmail, matrix)
    const hiddenArray = Array.from(hiddenSet)

    setOutlineHiddenRows(activeSheetId, hiddenArray)
  }, [rules, activeSheetId, gridSheets, userRole, userId, userEmail, setOutlineHiddenRows])
}
