'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { assertCanManage, type WorkbookRole } from '@/lib/permissions'

const inviteSchema = z.object({
  workbookId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
})

const updateSchema = z.object({
  workbookId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'editor', 'viewer']),
})

const removeSchema = z.object({
  workbookId: z.string().uuid(),
  userId: z.string().uuid(),
})

export interface MemberRow {
  userId: string
  email: string | null
  displayName: string | null
  role: WorkbookRole
}

export async function listMembersAction(workbookId: string): Promise<MemberRow[]> {
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('workbook_members')
    .select('user_id, role, profiles:profiles!workbook_members_user_id_fkey(email, display_name)')
    .eq('workbook_id', workbookId)
  if (!data) return []
  return data.map((row) => {
    const profileList = (row as { profiles?: Array<{ email?: string | null; display_name?: string | null }> }).profiles
    const first = Array.isArray(profileList) ? profileList[0] : profileList
    return {
      userId: row.user_id as string,
      email: first?.email ?? null,
      displayName: first?.display_name ?? null,
      role: row.role as WorkbookRole,
    }
  })
}

export async function inviteMemberAction(input: z.input<typeof inviteSchema>) {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const ctx = await assertCanManage(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const service = getServiceRoleSupabase()
  if (!service) return { ok: false as const, error: 'Supabase service role not configured' }

  // Look up user by email; if not found, store invitation as a pending row
  // (out of scope for this scaffolded session; today we require pre-existing
  // profile rows).
  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .maybeSingle()
  if (!profile) return { ok: false as const, error: 'User not found' }

  const { error } = await service.from('workbook_members').upsert(
    {
      workbook_id: parsed.data.workbookId,
      user_id: profile.id,
      role: parsed.data.role,
      invited_by: ctx.userId,
    },
    { onConflict: 'workbook_id,user_id' }
  )
  if (error) return { ok: false as const, error: error.message }

  await service.from('audit_logs').insert({
    workbook_id: parsed.data.workbookId,
    actor_id: ctx.userId,
    action: 'member.invite',
    target_type: 'profile',
    target_id: profile.id as string,
    metadata_json: { email: parsed.data.email, role: parsed.data.role },
  })

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const }
}

export async function updateMemberRoleAction(input: z.input<typeof updateSchema>) {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const ctx = await assertCanManage(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const service = getServiceRoleSupabase()
  if (!service) return { ok: false as const, error: 'Supabase service role not configured' }

  const { error } = await service
    .from('workbook_members')
    .update({ role: parsed.data.role })
    .eq('workbook_id', parsed.data.workbookId)
    .eq('user_id', parsed.data.userId)

  if (error) return { ok: false as const, error: error.message }

  await service.from('audit_logs').insert({
    workbook_id: parsed.data.workbookId,
    actor_id: ctx.userId,
    action: 'member.role_changed',
    target_type: 'profile',
    target_id: parsed.data.userId,
    metadata_json: { role: parsed.data.role },
  })

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const }
}

export async function removeMemberAction(input: z.input<typeof removeSchema>) {
  const parsed = removeSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const ctx = await assertCanManage(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const service = getServiceRoleSupabase()
  if (!service) return { ok: false as const, error: 'Supabase service role not configured' }

  // Owner cannot remove themselves while still being the only owner.
  const { data: members } = await service
    .from('workbook_members')
    .select('user_id, role')
    .eq('workbook_id', parsed.data.workbookId)
  const owners = members?.filter((m: { role: string }) => m.role === 'owner') ?? []
  if (parsed.data.userId === ctx.userId && owners.length <= 1) {
    return { ok: false as const, error: 'Cannot remove the only owner' }
  }

  const { error } = await service
    .from('workbook_members')
    .delete()
    .eq('workbook_id', parsed.data.workbookId)
    .eq('user_id', parsed.data.userId)

  if (error) return { ok: false as const, error: error.message }

  await service.from('audit_logs').insert({
    workbook_id: parsed.data.workbookId,
    actor_id: ctx.userId,
    action: 'member.removed',
    target_type: 'profile',
    target_id: parsed.data.userId,
  })

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const }
}
