'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const STORAGE_KEY = 'quiksheets_sidebar_collapsed'
const NARROW_BREAKPOINT_PX = 768

/**
 * Owns sidebar-collapsed state + the three side effects that keep it in sync:
 *
 *   1. On mount: honour `localStorage[quiksheets_sidebar_collapsed]` if set,
 *      otherwise auto-collapse on narrow viewports (< 768 px).
 *   2. On viewport resize that crosses the narrow breakpoint: auto-collapse.
 *   3. On state change: persist the value back to localStorage so it
 *      survives reloads / new tabs.
 *
 * SSR safety: initial value is `false` on both server and client so the
 * hydration markup matches. The mount effect synchronises to the saved
 * preference (or viewport heuristic) immediately on the client only.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim from the original
 * inline effects.
 */
export function useSidebarCollapsed(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [collapsed, setCollapsed] = useState(false)

  // (1) Mount: honour user preference, fall back to viewport heuristic.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === '1') {
        setCollapsed(true)
        return
      }
      if (saved === '0') {
        setCollapsed(false)
        return
      }
    } catch {
      // localStorage unavailable — fall through to viewport heuristic.
    }
    if (window.innerWidth < NARROW_BREAKPOINT_PX) setCollapsed(true)
  }, [])

  // (2) Auto-collapse on viewport resize crossing the breakpoint.
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < NARROW_BREAKPOINT_PX) setCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // (3) Persist the user's choice so it carries across reloads / new tabs.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore — same swallow as the original inline effect */
    }
  }, [collapsed])

  return [collapsed, setCollapsed]
}
