/**
 * Browser Supabase client. Safe to import from any client component.
 * Reads only the public env (URL + anon key).
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'

let cached: SupabaseClient | null = null

export function getBrowserSupabase(): SupabaseClient | null {
  if (cached) return cached
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }
  cached = createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return cached
}
