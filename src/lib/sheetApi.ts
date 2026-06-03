import { supabase } from '@/lib/supabase'
import { getServiceRoleSupabase } from '@/lib/supabase/server'

export interface WorkbookPayload {
  id?: string
  name: string
  data: unknown
  /**
   * Optimistic-concurrency token: the `updated_at` the client last loaded
   * or saved. When present on an UPDATE, the save only succeeds if the
   * row's current `updated_at` still matches — otherwise someone else
   * saved in the meantime and we return 409 instead of silently
   * overwriting their work. Absent → unconditional update (first save /
   * legacy clients), so this never blocks a save it can't reason about.
   */
  baseUpdatedAt?: string
  /** Returned by the load path so the client can send it back as baseUpdatedAt. */
  updatedAt?: string
}

/** Build a save success result, omitting updatedAt when absent (exactOptionalPropertyTypes). */
function savedResult(id: string, updatedAt: string | undefined): { id: string; updatedAt?: string } {
  return { id, ...(updatedAt ? { updatedAt } : {}) }
}

/** 409 returned when a stale write is detected (someone else saved first). */
function conflictResponse(currentUpdatedAt: string | null): Response {
  return Response.json(
    {
      error: 'conflict',
      message: 'This workbook was changed by someone else since you last loaded it.',
      currentUpdatedAt,
    },
    { status: 409 },
  )
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
): Promise<{ id: string; updatedAt?: string } | { response: Response }> {
  if (!supabase) {
    return {
      response: Response.json(
        { error: 'Supabase is not configured for workbook API requests.' },
        { status: 503 }
      ),
    }
  }

  if (payload.id) {
    const base = payload.baseUpdatedAt
    // Fast path: try as owner. When a base version is supplied, the update
    // is conditional on `updated_at` still matching (optimistic concurrency).
    let ownerQuery = supabase
      .from('workbooks')
      .update({ name: payload.name, data: payload.data })
      .eq('id', payload.id)
      .eq('owner_id', userId)
    if (base) ownerQuery = ownerQuery.eq('updated_at', base)
    const ownerUpdate = await ownerQuery.select('id,updated_at').maybeSingle()

    if (ownerUpdate.data) {
      return savedResult(payload.id, (ownerUpdate.data as { updated_at?: string }).updated_at)
    }
    if (ownerUpdate.error) {
      return {
        response: Response.json(
          { error: 'Failed to update workbook.', details: ownerUpdate.error.message },
          { status: 500 }
        ),
      }
    }

    // Owner update matched 0 rows. With a base filter that can mean the owner
    // row exists but its updated_at moved on → a real conflict (someone else
    // saved), NOT a permissions miss. Detect it before the editor fallback.
    if (base) {
      const ownerCheck = await supabase
        .from('workbooks')
        .select('updated_at')
        .eq('id', payload.id)
        .eq('owner_id', userId)
        .maybeSingle()
      if (ownerCheck.data) {
        return { response: conflictResponse((ownerCheck.data as { updated_at?: string }).updated_at ?? null) }
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

    let editorQuery = service
      .from('workbooks')
      .update({ name: payload.name, data: payload.data })
      .eq('id', payload.id)
    if (base) editorQuery = editorQuery.eq('updated_at', base)
    const editorUpdate = await editorQuery.select('id,updated_at').maybeSingle()

    if (editorUpdate.error) {
      return {
        response: Response.json(
          { error: 'Failed to update workbook.', details: editorUpdate.error.message },
          { status: 500 }
        ),
      }
    }
    if (editorUpdate.data) {
      return savedResult(payload.id, (editorUpdate.data as { updated_at?: string }).updated_at)
    }

    // Editor update matched 0 rows. With a base filter: conflict if the row
    // still exists, else it's gone (404). Without a base, preserve the
    // original behaviour and treat it as success.
    if (base) {
      const exists = await service
        .from('workbooks')
        .select('updated_at')
        .eq('id', payload.id)
        .maybeSingle()
      if (exists.data) {
        return { response: conflictResponse((exists.data as { updated_at?: string }).updated_at ?? null) }
      }
      return { response: Response.json({ error: 'Workbook not found.' }, { status: 404 }) }
    }
    return { id: payload.id }
  }

  const { data, error } = await supabase
    .from('workbooks')
    .insert({ name: payload.name, data: payload.data, owner_id: userId })
    .select('id,updated_at')
    .single()

  if (error) {
    return {
      response: Response.json(
        { error: 'Failed to create workbook.', details: error.message },
        { status: 500 }
      ),
    }
  }

  const row = data as { id: string; updated_at?: string }
  return savedResult(String(row.id), row.updated_at)
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
    .select('id,name,data,updated_at')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownerQuery.data) {
    return toWorkbookPayload(ownerQuery.data)
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
    .select('id,name,data,updated_at')
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

  return toWorkbookPayload(workbookQuery.data)
}

/** Map a workbooks row (snake_case updated_at) to the WorkbookPayload shape. */
function toWorkbookPayload(row: unknown): WorkbookPayload {
  const r = (row ?? {}) as { id?: string; name?: string; data?: unknown; updated_at?: string }
  return {
    ...(r.id ? { id: String(r.id) } : {}),
    name: r.name ?? '',
    data: r.data,
    ...(r.updated_at ? { updatedAt: r.updated_at } : {}),
  }
}
