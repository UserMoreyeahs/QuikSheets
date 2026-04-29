import {
  authenticateSheetRequest,
  loadWorkbookRecord,
  saveWorkbookRecord,
  type WorkbookPayload,
} from '@/lib/sheetApi'

function isWorkbookPayload(value: unknown): value is WorkbookPayload & { accessToken?: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.name === 'string' && 'data' in candidate
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim()

  if (!id) {
    return Response.json({ error: 'Missing workbook id.' }, { status: 400 })
  }

  const authResult = await authenticateSheetRequest(request)
  if ('response' in authResult) {
    return authResult.response
  }

  const workbook = await loadWorkbookRecord(id, authResult.user.id)
  if ('response' in workbook) {
    return workbook.response
  }

  return Response.json({ workbook })
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isWorkbookPayload(body)) {
    return Response.json(
      { error: 'Expected a workbook payload with a string name and data.' },
      { status: 400 }
    )
  }

  const candidate = body as WorkbookPayload & { accessToken?: string }
  const authResult = await authenticateSheetRequest(request, candidate.accessToken ?? null)
  if ('response' in authResult) {
    return authResult.response
  }

  const result = await saveWorkbookRecord(
    {
      ...(candidate.id ? { id: candidate.id } : {}),
      name: candidate.name.trim(),
      data: candidate.data,
    },
    authResult.user.id
  )

  if ('response' in result) {
    return result.response
  }

  return Response.json({ id: result.id })
}
