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

  await assertCanEdit(parsed.data.workbookId).catch(() => null)

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
      is_public: parsed.data.isPublic,
      fields_json: parsed.data.fields,
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
    .select('id, workbook_id, sheet_id, name, slug, is_public, fields_json')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id as string,
    workbookId: data.workbook_id as string,
    sheetId: data.sheet_id as string,
    name: data.name as string,
    slug: data.slug as string,
    isPublic: Boolean(data.is_public),
    fields: data.fields_json as FormField[],
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
    .select('id, workbook_id, sheet_id, fields_json, is_public')
    .eq('slug', parsed.data.slug)
    .maybeSingle()
  if (formErr || !form) return { ok: false as const, error: 'Form not found' }
  if (!form.is_public) return { ok: false as const, error: 'Form is not public' }

  // Insert submission record.
  const { data: submission, error: subErr } = await service
    .from('form_submissions')
    .insert({ form_id: form.id, submission_json: parsed.data.values })
    .select('id')
    .single()
  if (subErr || !submission) return { ok: false as const, error: subErr?.message ?? 'Submission failed' }

  // Determine the next row index (max + 1) for the target sheet, then write
  // one row of cells.
  const { data: lastCell } = await service
    .from('cells')
    .select('row_index')
    .eq('sheet_id', form.sheet_id)
    .order('row_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextRow = ((lastCell?.row_index as number | undefined) ?? 0) + 1

  const fields = (form.fields_json as FormField[]) ?? []
  const cellsToWrite = fields.map((field) => {
    const raw = parsed.data.values[field.id]
    return {
      workbook_id: form.workbook_id,
      sheet_id: form.sheet_id,
      row_index: nextRow,
      column_index: field.columnIndex,
      address: '', // computed by db trigger or downstream
      raw_value: raw === undefined || raw === null ? null : String(raw),
    }
  })
  if (cellsToWrite.length > 0) {
    await service.from('cells').upsert(cellsToWrite, {
      onConflict: 'sheet_id,row_index,column_index',
    })
  }

  return { ok: true as const, rowId: nextRow }
}
