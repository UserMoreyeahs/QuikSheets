import { supabase } from '@/lib/supabase'

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

export async function saveWorkbookRecord(
  payload: WorkbookPayload,
  ownerId: string
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
    const { error } = await supabase
      .from('workbooks')
      .update({ name: payload.name, data: payload.data })
      .eq('id', payload.id)
      .eq('owner_id', ownerId)

    if (error) {
      return {
        response: Response.json(
          { error: 'Failed to update workbook.', details: error.message },
          { status: 500 }
        ),
      }
    }

    return { id: payload.id }
  }

  const { data, error } = await supabase
    .from('workbooks')
    .insert({ name: payload.name, data: payload.data, owner_id: ownerId })
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

export async function loadWorkbookRecord(
  id: string,
  ownerId: string
): Promise<WorkbookPayload | { response: Response }> {
  if (!supabase) {
    return {
      response: Response.json(
        { error: 'Supabase is not configured for workbook API requests.' },
        { status: 503 }
      ),
    }
  }

  const { data, error } = await supabase
    .from('workbooks')
    .select('id,name,data')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .single()

  if (error) {
    return {
      response: Response.json(
        { error: 'Workbook not found.', details: error.message },
        { status: 404 }
      ),
    }
  }

  return data as WorkbookPayload
}
