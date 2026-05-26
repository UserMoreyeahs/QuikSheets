'use client'

/**
 * GoogleSignInButton — single-click OAuth via Supabase Auth.
 *
 * Behavior:
 *   1. Click → calls supabase.auth.signInWithOAuth({ provider: 'google' })
 *   2. Supabase redirects to Google's consent screen
 *   3. Google bounces back to /auth/callback with a code
 *   4. /auth/callback exchanges the code for a session (cookies set)
 *   5. User lands on /dashboard
 *
 * Requires:
 *   - Google OAuth client configured in Supabase Dashboard
 *     (Authentication → Providers → Google → enable + paste client id/secret)
 *   - The Vercel deployment URL added to "Allowed redirect URLs" in
 *     both Supabase Auth settings and the Google Cloud Console.
 */

import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'

interface Props {
  /** Where to send the user after a successful login. Default: /dashboard */
  redirectTo?: string
  /** Optional label override. Default: "Continue with Google" */
  label?: string
}

export function GoogleSignInButton({ redirectTo = '/dashboard', label = 'Continue with Google' }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    const supabase = getBrowserSupabase()
    if (!supabase) {
      setError('Supabase is not configured.')
      setPending(false)
      return
    }
    // The site URL is fed back by Supabase to Google; the final landing
    // page (dashboard) is encoded in the `next` query param of the
    // /auth/callback route handler.
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const callback = `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback },
    })
    if (error) {
      setError(error.message)
      setPending(false)
    }
    // On success the page navigates away — no need to clear `pending`.
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <GoogleIcon />
        {pending ? 'Redirecting to Google…' : label}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
