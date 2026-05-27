/**
 * /s/[token] — Share-link landing page.
 *
 * Resolution flow:
 *   1. Call resolveShareTokenAction (service-role Supabase, rate-limited).
 *      • ok → redirect to /sheet/<workbookId>?via=share&role=<role>
 *      • expired | inactive → redirect to /unauthorized (no localStorage fallback
 *        — the token was found in Supabase but is no longer valid)
 *      • not_found → fall through to step 2
 *   2. Render LocalShareTokenResolver (client component) to check localStorage.
 *      This covers standalone mode and links created before Supabase was wired.
 *      If the client resolver also fails it sends the user to /unauthorized itself.
 *
 * Security note: the service-role key is NEVER sent to the client.
 * resolveShareTokenAction runs server-side only.
 */

import { redirect } from 'next/navigation'
import { resolveShareTokenAction } from '@/features/share-links/actions'
import { LocalShareTokenResolver } from '@/features/share-links/components/LocalShareTokenResolver'

interface ShareRoutePageProps {
  params: Promise<{ token: string }>
}

export default async function ShareRoutePage({ params }: ShareRoutePageProps) {
  const { token } = await params

  // Sanitise token — must be non-empty and reasonably short
  if (!token || token.length > 80) {
    redirect('/unauthorized')
  }

  const result = await resolveShareTokenAction({ token })

  if (result.ok && result.workbookId) {
    // Valid Supabase link → open the workbook
    redirect(`/sheet/${result.workbookId}?via=share&role=${result.role}`)
  }

  if (result.reason === 'expired' || result.reason === 'inactive') {
    // Found in Supabase but no longer valid — skip localStorage fallback
    redirect('/unauthorized')
  }

  // reason === 'not_found': token not in Supabase (standalone link, or Supabase
  // not configured) — delegate to the client-side localStorage resolver.
  return <LocalShareTokenResolver token={token} />
}
