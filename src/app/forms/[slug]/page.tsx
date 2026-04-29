import { notFound } from 'next/navigation'
import { getFormBySlug } from '@/features/forms/actions'
import { PublicFormClient } from '@/features/forms/components/PublicForm'

interface FormPageProps {
  params: Promise<{ slug: string }>
}

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params
  const form = await getFormBySlug(slug)
  if (!form || !form.isPublic) notFound()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <PublicFormClient form={form} />
    </main>
  )
}
