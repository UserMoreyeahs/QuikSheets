'use client'

import { getBrowserSupabase } from './client'

/**
 * Lightweight session context the persistence APIs care about.
 * displayName is sourced from `user_metadata.display_name`, then
 * `full_name`, then `email`, in that order — null when none exist.
 */
export interface ClientSession {
  userId: string
  displayName: string | null
}

/**
 * Resolve the current browser-side Supabase session into a small
 * `{ userId, displayName }` context. Returns `null` when:
 *   - Supabase env vars are absent (`getBrowserSupabase()` returns null)
 *   - The user has no active session
 *   - `auth.getUser()` throws (network blip, malformed JWT, etc.)
 *
 * Consolidates the identical inline `getSession()` helper that was
 * previously copy-pasted across commentsApi, cfRulesApi, columnTypesApi,
 * and versionsApi (and inlined into shareLinksApi / notificationsApi).
 */
export async function getClientSession(): Promise<ClientSession | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return null
    const displayName =
      (user.user_metadata?.['display_name'] as string | undefined) ??
      (user.user_metadata?.['full_name'] as string | undefined) ??
      user.email ??
      null
    return { userId: user.id, displayName }
  } catch {
    return null
  }
}
