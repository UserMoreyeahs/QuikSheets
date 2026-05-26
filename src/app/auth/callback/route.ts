/**
 * /auth/callback — OAuth code-exchange endpoint.
 *
 * Supabase's OAuth flow (Google / GitHub / etc.) redirects here with a
 * `code` query param after the user consents. We exchange that code
 * for a session via the server-side Supabase client, which sets the
 * auth cookie. Then we redirect to `?next=<path>` (default /dashboard).
 *
 * Required setup:
 *   1. Supabase Dashboard → Authentication → Providers → Google → enable,
 *      paste Google client ID + secret.
 *   2. Supabase Dashboard → Authentication → URL Configuration → add
 *      production + preview redirect URLs:
 *        https://quiksheets-v2.vercel.app/auth/callback
 *        http://localhost:3000/auth/callback
 *   3. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0
 *      Client → "Authorized redirect URIs" must include the Supabase
 *      callback URL shown in the Supabase provider config — usually:
 *        https://mrvzwwfnimqufendjfhj.supabase.co/auth/v1/callback
 */

import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  if (!code) {
    // Direct hit without a code — bounce to login with an explainer.
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const supabase = await getServerSupabase()
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=supabase_not_configured', url.origin))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Most common cause: redirect URL mismatch between Google Cloud Console
    // and Supabase. Surface the message so users can fix their config.
    const params = new URLSearchParams({ error: 'oauth_exchange_failed', detail: error.message })
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, url.origin))
  }

  // Success — cookie set by exchangeCodeForSession. Forward to `next`.
  // We restrict `next` to same-origin paths to prevent open-redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
