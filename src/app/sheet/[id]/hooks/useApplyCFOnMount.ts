'use client'

import { useEffect } from 'react'
import { applyAllCFRules } from '@/features/conditional-formatting'

/**
 * Apply saved conditional-formatting rules to the workbook once after
 * mount, on a 500 ms delay so FortuneSheet has time to hydrate first.
 *
 * The void on applyAllCFRules silences the floating-promise lint since
 * the function is async (Wave 2 / cfRulesApi turned the CF persistence
 * Supabase-first and the loader returns a Promise).
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useApplyCFOnMount(workbookId: string): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void applyAllCFRules(workbookId)
    }, 500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
