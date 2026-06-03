'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { assertCanEdit } from '@/lib/permissions'
import type { FormDefinition, FormField } from './types'

const fieldSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(120),
  columnIndex: z.number().int().nonnegative(),
  kind: z.enum(['text', 'number', 'email', 'date', 'select', 'checkbox', 'currency', 'status']),
  required: z.boolean(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(),
})

const createSchema = z.object({
  workbookId: z.string().uuid(),
  sheetId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80),
  isPublic: z.boolean(),
  fields: z.array(fieldSchema).min(1).max(50),
})

const submitSchema = z.object({
  slug: z.string().trim().min(1),
  values: z.record(z.union([z.string(), z.number(), z.boolean()])),
  honeypot: z.string().optional(),
})

export async function createFormAction(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid form definition' }

  // Require editor permission before creating a form binding.
  try {
    await assertCanEdit(parsed.data.workbookId)
  } catch {
    return { ok: false as const, error: 'Forbidden' }
  }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('forms')
    .insert({
      workbook_id: parsed.data.workbookId,
      sheet_id: parsed.data.sheetId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      accepts_submissions: parsed.data.isPublic,
      fields: parsed.data.fields,
      created_by: user.id,
    })
    .select('id, slug')
    .single()

  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }
  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, id: data.id as string, slug: data.slug as string }
}

export async function getFormBySlug(slug: string): Promise<FormDefinition | null> {
  const service = getServiceRoleSupabase()
  if (!service) return null
  const { data, error } = await service
    .from('forms')
    .select('id, workbook_id, sheet_id, name, slug, accepts_submissions, fields')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id as string,
    workbookId: data.workbook_id as string,
    sheetId: data.sheet_id as string,
    name: data.name as string,
    slug: data.slug as string,
    isPublic: Boolean(data.accepts_submissions),
    fields: data.fields as FormField[],
  }
}

export async function submitFormAction(input: z.input<typeof submitSchema>) {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid submission' }

  // Honeypot — silently accept and discard.
  if (parsed.data.honeypot && parsed.data.honeypot.length > 0) {
    return { ok: true as const, dropped: true }
  }

  const service = getServiceRoleSupabase()
  if (!service) return { ok: false as const, error: 'Supabase not configured' }

  const { data: form, error: formErr } = await service
    .from('forms')
    .select('id, workbook_id, sheet_id, fields, accepts_submissions')
    .eq('slug', parsed.data.slug)
    .maybeSingle()
  if (formErr || !form) return { ok: false as const, error: 'Form not found' }
  if (!form.accepts_submissions) return { ok: false as const, error: 'Form is not accepting submissions' }

  // Insert submission record.
  const { data: submission, error: subErr } = await service
    .from('form_submissions')
    .insert({ form_id: form.id, values: parsed.data.values })
    .select('id')
    .single()
  if (subErr || !submission) return { ok: false as const, error: subErr?.message ?? 'Submission failed' }

  return { ok: true as const, id: submission.id as string }
}
