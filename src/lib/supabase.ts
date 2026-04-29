/**
 * Back-compat shim. New code should import from:
 *   - '@/lib/supabase/client' for the browser client
 *   - '@/lib/supabase/server' for the server / service-role client
 *
 * This file retains a `supabase` export so existing legacy callers keep
 * working until they are migrated session by session.
 */
import { getBrowserSupabase } from './supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export const supabase: SupabaseClient | null = getBrowserSupabase()
