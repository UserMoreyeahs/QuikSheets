/**
 * /forms/[slug]
 *
 * Public form viewer. Renders the form definition from Supabase (via the
 * "public read by slug" RLS policy that lets anonymous visitors SELECT a
 * form whose `accepts_submissions = true`).
 *
 * The page is a client component so the fetch + submit both run through
 * the browser Supabase client (no service-role key on the public route).
 */

import { PublicFormBySlug } from '@/features/forms/components/PublicFormBySlug'

interface FormPageProps {
  params: Promise<{ slug: string }>
}

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <PublicFormBySlug slug={slug} />
    </main>
  )
}
