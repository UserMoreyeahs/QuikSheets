'use client'

/**
 * LocalShareTokenResolver
 * --------------------------------------------------------------------------
 * Client-side fallback for /s/[token] — checks the localStorage share-link
 * store after the server (Supabase) returned "not found".  This is what
 * makes standalone-mode links actually open a workbook instead of dead-ending
 * at /unauthorized.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldX } from 'lucide-react'
import { resolveLocalShareToken } from '@/features/share-links/storage/localShareLinks'

type State =
  | { status: 'loading' }
  | { status: 'redirecting' }
  | { status: 'denied'; reason: 'not_found' | 'expired' | 'inactive' }

export function LocalShareTokenResolver({ token }: { token: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const result = resolveLocalShareToken(token)
    if (result.ok && result.workbookId) {
      setState({ status: 'redirecting' })
      router.replace(`/sheet/${result.workbookId}?via=share&role=${result.role}`)
      return
    }
    setState({ status: 'denied', reason: result.reason ?? 'not_found' })
  }, [token, router])

  if (state.status === 'loading' || state.status === 'redirecting') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.status === 'loading' ? 'Resolving link…' : 'Opening workbook…'}
        </div>
      </main>
    )
  }

  // denied
  const reasonText =
    state.reason === 'expired'
      ? 'This share link has expired.'
      : state.reason === 'inactive'
        ? 'This share link has been revoked.'
        : 'This share link does not exist or was created in a different browser.'

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <ShieldX className="mx-auto mb-3 h-8 w-8 text-rose-500" />
        <h1 className="text-lg font-semibold text-zinc-900">Link not available</h1>
        <p className="mt-2 text-sm text-zinc-600">{reasonText}</p>
        <p className="mt-4 text-[12px] text-zinc-400">
          Local share links are saved per-browser in standalone mode — ask the link creator
          to share from a connected workspace if you&apos;re on a different machine.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Go to dashboard
        </a>
      </div>
    </main>
  )
}
