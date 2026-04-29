'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase/server'

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  workspaceId: z.string().uuid(),
})

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
})

const idSchema = z.object({ id: z.string().uuid() })

export interface WorkbookSummary {
  id: string
  workspaceId: string
  ownerId: string
  name: string
  description: string | null
  updatedAt: string
  lastOpenedAt: string | null
}

export async function listWorkbooksAction(): Promise<WorkbookSummary[]> {
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('workbooks')
    .select('id, workspace_id, owner_id, name, description, updated_at, last_opened_at')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    updatedAt: row.updated_at as string,
    lastOpenedAt: (row.last_opened_at as string | null) ?? null,
  }))
}

export async function createWorkbookAction(input: { name: string; workspaceId: string }) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Not authenticated' }

  const { data: workbook, error } = await supabase
    .from('workbooks')
    .insert({ name: parsed.data.name, workspace_id: parsed.data.workspaceId, owner_id: user.id })
    .select('id')
    .single()

  if (error || !workbook) return { ok: false as const, error: error?.message ?? 'Insert failed' }

  // Create default Sheet1
  await supabase.from('sheets').insert({ workbook_id: workbook.id, name: 'Sheet1', index_order: 0 })

  // Owner membership
  await supabase
    .from('workbook_members')
    .insert({ workbook_id: workbook.id, user_id: user.id, role: 'owner' })

  revalidatePath('/dashboard')
  return { ok: true as const, id: workbook.id as string }
}

export async function renameWorkbookAction(input: { id: string; name: string }) {
  const parsed = renameSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }
  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }
  const { error } = await supabase
    .from('workbooks')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true as const }
}

export async function deleteWorkbookAction(input: { id: string }) {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }
  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }
  const { error } = await supabase.from('workbooks').delete().eq('id', parsed.data.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true as const }
}
