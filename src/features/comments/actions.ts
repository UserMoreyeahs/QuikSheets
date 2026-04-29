'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { assertCanEdit, assertCanRead } from '@/lib/permissions'

const createSchema = z.object({
  workbookId: z.string().uuid(),
  sheetId: z.string().uuid(),
  cellAddress: z.string().min(1).max(20),
  body: z.string().trim().min(1).max(5000),
  mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
})

const idSchema = z.object({ id: z.string().uuid(), workbookId: z.string().uuid() })

const resolveSchema = z.object({
  id: z.string().uuid(),
  workbookId: z.string().uuid(),
  resolved: z.boolean(),
})

export interface CommentRow {
  id: string
  cellAddress: string
  body: string
  authorId: string
  authorName: string | null
  resolved: boolean
  createdAt: string
}

export async function listCommentsAction(workbookId: string, sheetId: string): Promise<CommentRow[]> {
  await assertCanRead(workbookId).catch(() => null)
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('comments')
    .select('id, cell_address, body, author_id, resolved, created_at, profiles:profiles!comments_author_id_fkey(display_name)')
    .eq('workbook_id', workbookId)
    .eq('sheet_id', sheetId)
    .order('created_at', { ascending: false })
  if (!data) return []
  return data.map((row) => {
    const profileList = (row as { profiles?: Array<{ display_name?: string | null }> | { display_name?: string | null } | null }).profiles
    const first = Array.isArray(profileList) ? profileList[0] : profileList
    return {
      id: row.id as string,
      cellAddress: row.cell_address as string,
      body: row.body as string,
      authorId: row.author_id as string,
      authorName: first?.display_name ?? null,
      resolved: Boolean(row.resolved),
      createdAt: row.created_at as string,
    }
  })
}

export async function createCommentAction(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid comment' }

  const ctx = await assertCanEdit(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const insertPayload: Record<string, unknown> = {
    workbook_id: parsed.data.workbookId,
    sheet_id: parsed.data.sheetId,
    cell_address: parsed.data.cellAddress,
    body: parsed.data.body,
    author_id: ctx.userId,
  }
  if (parsed.data.mentionedUserIds && parsed.data.mentionedUserIds.length > 0) {
    insertPayload.mentioned_user_ids = parsed.data.mentionedUserIds
  }

  const { data, error } = await supabase.from('comments').insert(insertPayload).select('id').single()
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }

  // Audit mention notifications
  const service = getServiceRoleSupabase()
  if (service && parsed.data.mentionedUserIds?.length) {
    await service.from('audit_logs').insert({
      workbook_id: parsed.data.workbookId,
      actor_id: ctx.userId,
      action: 'comment.mention',
      target_type: 'comment',
      target_id: data.id as string,
      metadata_json: { mentioned: parsed.data.mentionedUserIds },
    })
  }

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, id: data.id as string }
}

export async function setCommentResolvedAction(input: z.input<typeof resolveSchema>) {
  const parsed = resolveSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }
  const ctx = await assertCanEdit(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }
  const { error } = await supabase
    .from('comments')
    .update({ resolved: parsed.data.resolved })
    .eq('id', parsed.data.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const }
}

export async function deleteCommentAction(input: z.input<typeof idSchema>) {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }
  const ctx = await assertCanEdit(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }
  const { error } = await supabase.from('comments').delete().eq('id', parsed.data.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const }
}
