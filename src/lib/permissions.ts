/**
 * Server-side permission service. Every server action that touches a
 * workbook MUST call one of these before any DB mutation. Even though
 * RLS will also enforce, this gives a clean error path and a single place
 * to wire audit logging.
 */
import { getServerSupabase } from '@/lib/supabase/server'

export type WorkbookRole = 'owner' | 'editor' | 'viewer'

export interface PermissionContext {
  userId: string
  workbookId: string
  role: WorkbookRole | null
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function getRole(workbookId: string): Promise<PermissionContext> {
  const supabase = await getServerSupabase()
  if (!supabase) throw new UnauthorizedError('Supabase not configured')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new UnauthorizedError()

  const { data } = await supabase
    .from('workbook_members')
    .select('role')
    .eq('workbook_id', workbookId)
    .eq('user_id', user.id)
    .maybeSingle()

  let role: WorkbookRole | null = null
  if (data && typeof data.role === 'string' && (data.role === 'owner' || data.role === 'editor' || data.role === 'viewer')) {
    role = data.role
  } else {
    // Fallback: maybe owner via workbooks.owner_id
    const { data: wb } = await supabase
      .from('workbooks')
      .select('owner_id')
      .eq('id', workbookId)
      .maybeSingle()
    if (wb?.owner_id === user.id) role = 'owner'
  }

  return { userId: user.id, workbookId, role }
}

export async function assertCanRead(workbookId: string): Promise<PermissionContext> {
  const ctx = await getRole(workbookId)
  if (!ctx.role) throw new ForbiddenError()
  return ctx
}

export async function assertCanEdit(workbookId: string): Promise<PermissionContext> {
  const ctx = await getRole(workbookId)
  if (ctx.role !== 'owner' && ctx.role !== 'editor') throw new ForbiddenError('Editor role required')
  return ctx
}

export async function assertCanManage(workbookId: string): Promise<PermissionContext> {
  const ctx = await getRole(workbookId)
  if (ctx.role !== 'owner') throw new ForbiddenError('Owner role required')
  return ctx
}
