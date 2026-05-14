/**
 * Browser Supabase client. Safe to import from any client component.
 * Reads only the public env (URL + anon key).
 *
 * Singleton — multiple imports return the same instance so that Supabase's
 * internal Web Locks ("sb-…-auth-token") aren't contested between client
 * instances inside the same tab.
 *
 * In React Strict Mode (dev), effects double-invoke and multiple components
 * may call `auth.getUser()` near-simultaneously. The Web Locks API then
 * throws `NavigatorLockAcquireTimeoutError` ("Lock was released because
 * another request stole it") on the losing promise — even though the
 * winning request has already returned fresh data and auth state is fine.
 *
 * Next.js's dev error overlay surfaces this benign rejection as a runtime
 * error. We install a one-time `unhandledrejection` listener that swallows
 * just this specific message, keeping the rest of the global error handler
 * intact.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'

let cached: SupabaseClient | null = null
let lockHandlerInstalled = false

/**
 * Install a single global handler that swallows the benign auth-lock
 * timeout rejections. Runs only on the client, only once.
 */
function installLockErrorHandler(): void {
  if (lockHandlerInstalled || typeof window === 'undefined') return
  lockHandlerInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown
    const msg =
      typeof reason === 'string'
        ? reason
        : (reason as { message?: string } | null | undefined)?.message ?? ''

    // Matches:
    //   "Lock 'lock:sb-…-auth-token' was released because another request stole it"
    //   "NavigatorLockAcquireTimeoutError: …"
    if (
      /Lock .* was released because another request stole it/i.test(msg) ||
      /NavigatorLockAcquireTimeoutError/i.test(msg)
    ) {
      event.preventDefault()
      // Optional: log at debug level so we still know it happened
      // eslint-disable-next-line no-console
      console.debug('[supabase] Ignored benign auth-lock contention:', msg)
    }
  })
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (cached) return cached
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }
  installLockErrorHandler()
  cached = createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return cached
}
