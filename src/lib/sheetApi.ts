import { supabase } from '@/lib/supabase'
import { getServiceRoleSupabase } from '@/lib/supabase/server'

export interface WorkbookPayload {
  id?: string
  name: string
  data: unknown
}

interface AuthenticatedUser {
  id: string
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  const token = authorization.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

export async function authenticateSheetRequest(
  request: Request,
  explicitToken?: string | null
): Promise<{ user: AuthenticatedUser } | { response: Response }> {
  if (!supabase) {
    return {
      response: Response.json(
        { error: 'Supabase is not configured for workbook API requests.' },
        { status: 503 }
      ),
    }
  }

  const accessToken = explicitToken?.trim() || getBearerToken(request)
  if (!accessToken) {
    return {
      response: Response.json(
        { error: 'Authentication is required for workbook API requests.' },
        { status: 401 }
      ),
    }
  }

  const { data, error } = await supabase.auth.getUser(accessToken)
  const user = data.user

  if (error || !user) {
    return {
      response: Response.json(
        { error: 'The provided access token is invalid or expired.' },
        { status: 401 }
      ),
    }
  }

  return { user: { id: user.id } }
}

/**
 * Save (insert or update) a workbook on behalf of `userId`.
 *
 * Access policy for UPDATE: user must be the owner OR an `editor`
 * member. Viewers are rejected (auto-save would silently no-op
 * otherwise, which is worse than a clean 403).
 *
 * Access policy for INSERT: anyone authenticated can create a workbook;
 * `owner_id` is fixed to the calling user. No member check needed.
 *
 * MVP test T011 — invited editors must be able to save their edits.
 */
export async function saveWorkbookRecord(
  payload: WorkbookPayload,
  userId: string
): Promise<{ id: string } | { response: Response }> {
  if (!supabase) {
    return {
      response: Response.json(
        { error: 'Supabase is not configured for workbook API requests.' },
        { status: 503 }
      ),
    }
  }

  if (payload.id) {
    // Fast path: try as owner.
    const ownerUpdate = await supabase
      .from('workbooks')
      .update({ name: payload.name, data: payload.data })
      .eq('id', payload.id)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle()

    if (ownerUpdate.data) {
      return { id: payload.id }
    }
    if (ownerUpdate.error) {
      return {
        response: Response.json(
          { error: 'Failed to update workbook.', details: ownerUpdate.error.message },
          { status: 500 }
        ),
      }
    }

    // Slow path: user is not the owner. Allow only if they are an
    // `editor` member.
    const service = getServiceRoleSupabase()
    if (!service) {
      return {
        response: Response.json(
          { error: 'Not allowed to edit this workbook.' },
          { status: 403 }
        ),
      }
    }

    const memberQuery = await service
      .from('workbook_members')
      .select('role')
      .eq('workbook_id', payload.id)
      .eq('user_id', userId)
      .maybeSingle()

    const role = (memberQuery.data as { role?: string } | null)?.role
    if (role !== 'owner' && role !== 'editor') {
      return {
        response: Response.json(
          { error: 'Not allowed to edit this workbook.' },
          { status: 403 }
        ),
      }
    }

    const { error: updateError } = await service
      .from('workbooks')
      .update({ name: payload.name, data: payload.data })
      .eq('id', payload.id)

    if (updateError) {
      return {
        response: Response.json(
          { error: 'Failed to update workbook.', details: updateError.message },
          { status: 500 }
        ),
      }
    }

    return { id: payload.id }
  }

  const { data, error } = await supabase
    .from('workbooks')
    .insert({ name: payload.name, data: payload.data, owner_id: userId })
    .select('id')
    .single()

  if (error) {
    return {
      response: Response.json(
        { error: 'Failed to create workbook.', details: error.message },
        { status: 500 }
      ),
    }
  }

  return { id: String((data as { id: string }).id) }
}

/**
 * Load a workbook record on behalf of `userId`.
 *
 * Access policy: user must be the workbook owner OR an invited member
 * (any role) via `workbook_members`. This mirrors the Supabase
 * `workbooks read` RLS policy, but we evaluate it in application code
 * because the browser supabase client used here has no server-side
 * auth context.
 *
 * MVP test T011 — "User invites ops@demo.com as editor; second user
 * can edit" — depends on this read-path accepting members, not just
 * owners. Before this fix, members hit 404 here because we only
 * filtered on `owner_id`.
 */
export async function loadWorkbookRecord(
  id: string,
  userId: string
): Promise<WorkbookPayload | { response: Response }> {
  if (!supabase) {
    return {
      response: Response.json(
        { error: 'Supabase is not configured for workbook API requests.' },
        { status: 503 }
      ),
    }
  }

  // Fast path: try as owner using the browser/anon client. If the
  // workbook is owned by this user we get the row directly.
  const ownerQuery = await supabase
    .from('workbooks')
    .select('id,name,data')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownerQuery.data) {
    return ownerQuery.data as WorkbookPayload
  }

  // Slow path: user might be an invited member. The anon client can't
  // read `workbook_members` because the RLS policy requires
  // auth.uid() === user_id (server-side, the anon client has no auth
  // context). So we use the service-role client which bypasses RLS,
  // and the membership row itself becomes our authoritative access
  // check.
  const service = getServiceRoleSupabase()
  if (!service) {
    return {
      response: Response.json(
        { error: 'Workbook not found.' },
        { status: 404 }
      ),
    }
  }

  const memberQuery = await service
    .from('workbook_members')
    .select('workbook_id')
    .eq('workbook_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!memberQuery.data) {
    return {
      response: Response.json(
        { error: 'Workbook not found.' },
        { status: 404 }
      ),
    }
  }

  // User is a verified member — load the workbook by id alone.
  const workbookQuery = await service
    .from('workbooks')
    .select('id,name,data')
    .eq('id', id)
    .single()

  if (workbookQuery.error || !workbookQuery.data) {
    return {
      response: Response.json(
        { error: 'Workbook not found.', details: workbookQuery.error?.message },
        { status: 404 }
      ),
    }
  }

  return workbookQuery.data as WorkbookPayload
}
