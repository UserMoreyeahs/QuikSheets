'use client'

import { useEffect } from 'react'
import { installHyperlinkFollow } from '@/features/ribbon/utils/cellOps'
import { useNLFilterUiStore } from '@/features/nl-filter/store/nlFilterUiStore'

/**
 * Three independent global listeners the sheet page needs to install on mount:
 *
 *   1. installHyperlinkFollow()         — Ctrl+Click on a hyperlink cell.
 *      Idempotent; safe to run on every mount.
 *
 *   2. window 'quiksheets:toggle-map'   — CustomEvent dispatched by
 *      ribbon ops (Trace Precedents / Dependents). Routes through a
 *      CustomEvent so cellOps doesn't need a direct page-component
 *      dependency. Calls the caller-supplied `toggleMap`.
 *
 *   3. Ctrl/Cmd + Shift + L             — toggle the NL filter bar
 *      visibility via useNLFilterUiStore.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useSheetPageGlobalListeners(opts: { toggleMap: () => void }): void {
  const { toggleMap } = opts
  const toggleNlFilter = useNLFilterUiStore((s) => s.toggle)

  // (1) Ctrl+Click hyperlink-follow on the canvas. Idempotent.
  useEffect(() => {
    installHyperlinkFollow()
  }, [])

  // (2) Custom DOM event routing for Trace Precedents/Dependents.
  useEffect(() => {
    function handle() { toggleMap() }
    window.addEventListener('quiksheets:toggle-map', handle)
    return () => window.removeEventListener('quiksheets:toggle-map', handle)
  }, [toggleMap])

  // (3) Ctrl/Cmd + Shift + L shortcut → NL filter visibility toggle.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        toggleNlFilter()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleNlFilter])
}
