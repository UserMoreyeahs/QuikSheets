'use client'

/**
 * LocalShareTokenResolver
 * --------------------------------------------------------------------------
 * Client-side fallback for /s/[token] — checks the localStorage share-link
 * store after the server (Supabase) returned "not found".  This is what
 * makes standalone-mode links actually open a workbook instead of dead-ending
 * at /unauthorized.
 *
 * If the local store also has no valid link, the user is redirected to
 * /unauthorized (consistent with the server-side behaviour for expired /
 * revoked links found in Supabase).
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { resolveLocalShareToken } from '@/features/share-links/storage/localShareLinks'

export function LocalShareTokenResolver({ token }: { token: string }) {
  const router = useRouter()

  useEffect(() => {
    const result = resolveLocalShareToken(token)
    if (result.ok && result.workbookId) {
      router.replace(`/sheet/${result.workbookId}?via=share&role=${result.role}`)
    } else {
      // Not found, expired, or revoked in local store — go to /unauthorized
      router.replace('/unauthorized')
    }
  }, [token, router])

  // Show a loading state while the effect runs (it resolves synchronously on
  // the next tick, so this is only visible for one frame in practice).
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Resolving link…
      </div>
    </main>
  )
}
