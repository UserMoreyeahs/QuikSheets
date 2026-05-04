/**
 * /form/[id]
 * Public form viewer for forms saved to localStorage by FormBuilder.
 * (The sister `/forms/[slug]` route uses Supabase — pick whichever fits.)
 */

import { PublicFormLocal } from '@/features/forms/components/PublicFormLocal'

interface FormPageProps {
  params: Promise<{ id: string }>
}

export default async function FormPage({ params }: FormPageProps) {
  const { id } = await params

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <PublicFormLocal formId={id} />
    </main>
  )
}
