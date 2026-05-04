/**
 * /s/[token] — Share-link landing page.
 *
 * Resolves the token via Supabase first (full audit + RLS).  If Supabase
 * has no record of it, we hand off to a client component that checks the
 * localStorage fallback used by standalone mode.
 */

import { redirect } from 'next/navigation'
import { resolveShareTokenAction } from '@/features/share-links/actions'
import { LocalShareTokenResolver } from '@/features/share-links/components/LocalShareTokenResolver'

interface ShareRoutePageProps {
  params: Promise<{ token: string }>
}

export default async function ShareRoutePage({ params }: ShareRoutePageProps) {
  const { token } = await params
  const result = await resolveShareTokenAction({ token })
  if (result.ok && result.workbookId) {
    redirect(`/sheet/${result.workbookId}?via=share&role=${result.role}`)
  }
  // Supabase didn't have it — let the client check localStorage before
  // we send the user to /unauthorized.
  return <LocalShareTokenResolver token={token} />
}
