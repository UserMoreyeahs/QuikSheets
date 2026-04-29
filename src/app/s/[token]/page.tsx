import { redirect } from 'next/navigation'
import { resolveShareTokenAction } from '@/features/share-links/actions'

interface ShareRoutePageProps {
  params: Promise<{ token: string }>
}

export default async function ShareRoutePage({ params }: ShareRoutePageProps) {
  const { token } = await params
  const result = await resolveShareTokenAction({ token })
  if (!result.ok || !result.workbookId) {
    redirect('/unauthorized')
  }
  redirect(`/sheet/${result.workbookId}?via=share&role=${result.role}`)
}
