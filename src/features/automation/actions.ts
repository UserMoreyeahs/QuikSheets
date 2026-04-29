'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase/server'
import { assertCanEdit } from '@/lib/permissions'

const triggerSchema = z.object({
  type: z.enum(['row_created', 'row_updated', 'status_changed']),
  sheetId: z.string().uuid(),
  statusColumnIndex: z.number().int().nonnegative().optional(),
  statusEquals: z.string().optional(),
})

const actionSchema = z.object({
  type: z.enum(['email', 'whatsapp', 'slack', 'teams', 'task']),
  config: z.record(z.union([z.string(), z.number(), z.boolean()])),
})

const createSchema = z.object({
  workbookId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  trigger: triggerSchema,
  action: actionSchema,
})

export async function createAutomationAction(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid automation' }

  await assertCanEdit(parsed.data.workbookId).catch(() => null)

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('automations')
    .insert({
      workbook_id: parsed.data.workbookId,
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      trigger_type: parsed.data.trigger.type,
      trigger_config_json: parsed.data.trigger,
      action_type: parsed.data.action.type,
      action_config_json: parsed.data.action.config,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, id: data.id as string }
}

export async function listAutomationsAction(workbookId: string) {
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('automations')
    .select('id, name, enabled, trigger_type, trigger_config_json, action_type, action_config_json, created_at')
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function listAutomationRunsAction(automationId: string) {
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('automation_runs')
    .select('id, status, error_message, created_at')
    .eq('automation_id', automationId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}
