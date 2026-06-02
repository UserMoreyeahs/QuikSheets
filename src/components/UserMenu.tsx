'use client'

/**
 * UserMenu
 * --------
 * Account avatar + dropdown shown in the sheet/dashboard header.
 *
 * The dropdown surfaces the only currently-implemented account action,
 * Sign Out, which routes through the existing `signOutAction` server
 * action — no custom auth code here.  When more actions land (Profile,
 * Settings, Switch Workspace, etc.) they belong as new <li> items in
 * the same dropdown.
 *
 * Designed for the slim 40-px header bar (h-7 avatar) so it sits
 * comfortably alongside <NotificationBell /> and <ThemeToggle />.
 */

import { useState, useRef, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { signOutAction } from '@/features/auth/actions'

interface UserSnapshot {
  email: string
  initial: string
}

async function loadUserSnapshot(): Promise<UserSnapshot | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    const u = data?.user
    if (!u) return null
    const email = u.email ?? ''
    const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string }
    const display = meta.full_name ?? meta.name ?? email
    const initial = (display || 'U').trim()[0]?.toUpperCase() ?? 'U'
    return { email, initial }
  } catch {
    return null
  }
}

export function UserMenu() {
  const [snapshot, setSnapshot] = useState<UserSnapshot | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load the current user once on mount.  Re-fetches are not needed —
  // signing out triggers a navigation to /login which remounts the tree.
  useEffect(() => {
    let cancelled = false
    void loadUserSnapshot().then((s) => {
      if (!cancelled) setSnapshot(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Close on click-outside / Escape.
  useEffect(() => {
    if (!open) return

    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // No user → don't render the menu (anonymous viewers).  The avatar
  // would just be a misleading "U" with nothing to log out of.
  if (!snapshot) return null

  const { email, initial } = snapshot

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={email || 'Account'}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold uppercase text-white shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {email && (
            <div className="border-b border-zinc-100 px-3 py-2 text-[11px] dark:border-zinc-700">
              <div className="text-zinc-500 dark:text-zinc-400">Signed in as</div>
              <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">{email}</div>
            </div>
          )}

          {/* Server-action form: clicking submits, signOutAction runs on
              the server (clears the Supabase session cookie) and redirects
              to /login.  No client-side fetch / state needed. */}
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
