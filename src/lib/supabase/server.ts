/**
 * Server-side Supabase clients.
 *
 * - getServerSupabase(): cookies-aware client for use in server components,
 *   server actions, and route handlers. Respects the user's session.
 * - getServiceRoleSupabase(): full-power client using SUPABASE_SERVICE_ROLE_KEY.
 *   Bypasses RLS — use only when the server-side caller has already
 *   verified the user's permission via lib/permissions.ts.
 *
 * Never import this file from a client component.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { publicEnv, serverEnv } from '@/lib/env'

export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }
  const cookieStore = await cookies()
  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (options) cookieStore.set(name, value, options)
              else cookieStore.set(name, value)
            })
          } catch {
            // The `set` method may be called from a Server Component; ignore
            // that case and rely on the middleware to refresh sessions.
          }
        },
      },
    }
  )
}

let serviceRoleCached: SupabaseClient | null = null

export function getServiceRoleSupabase(): SupabaseClient | null {
  if (serviceRoleCached) return serviceRoleCached
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }
  serviceRoleCached = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  return serviceRoleCached
}
