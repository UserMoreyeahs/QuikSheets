'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { assertCanManage } from '@/lib/permissions'

const createSchema = z.object({
  workbookId: z.string().uuid(),
  sheetId: z.string().uuid(),
  rangeRef: z.string().min(1).max(40),
  allowedUserIds: z.array(z.string().uuid()).max(50).default([]),
  allowedRoles: z.array(z.enum(['owner', 'editor', 'viewer'])).max(3).default([]),
})

export async function createProtectedRangeAction(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const ctx = await assertCanManage(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('protected_ranges')
    .insert({
      workbook_id: parsed.data.workbookId,
      sheet_id: parsed.data.sheetId,
      range_ref: parsed.data.rangeRef,
      allowed_user_ids: parsed.data.allowedUserIds,
      allowed_roles: parsed.data.allowedRoles,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }
  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, id: data.id as string }
}

export async function listProtectedRangesAction(workbookId: string, sheetId: string) {
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('protected_ranges')
    .select('id, range_ref, allowed_user_ids, allowed_roles, created_by, created_at')
    .eq('workbook_id', workbookId)
    .eq('sheet_id', sheetId)
  return data ?? []
}

/**
 * Server-side guard called by upsertCellsAction (R6) before any write.
 * Returns the range_ref that blocks the write, or null if all writes are
 * permitted.
 */
export async function findBlockingProtectedRange(input: {
  workbookId: string
  sheetId: string
  cells: Array<{ rowIndex: number; columnIndex: number }>
  userId: string
  role: 'owner' | 'editor' | 'viewer'
}): Promise<string | null> {
  const service = getServiceRoleSupabase()
  if (!service) return null
  const { data } = await service
    .from('protected_ranges')
    .select('range_ref, allowed_user_ids, allowed_roles')
    .eq('workbook_id', input.workbookId)
    .eq('sheet_id', input.sheetId)
  if (!data) return null

  for (const range of data) {
    const allowedUsers = (range.allowed_user_ids as string[] | null) ?? []
    const allowedRoles = (range.allowed_roles as string[] | null) ?? []
    if (allowedUsers.includes(input.userId)) continue
    if (allowedRoles.includes(input.role)) continue
    if (cellsIntersectRange(input.cells, range.range_ref as string)) {
      return range.range_ref as string
    }
  }
  return null
}

function cellsIntersectRange(
  cells: Array<{ rowIndex: number; columnIndex: number }>,
  rangeRef: string
): boolean {
  // Simple A1:B5 parser. Returns true if any cell falls inside the box.
  const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i)
  if (!match) return false
  const [, c1, r1, c2, r2] = match
  if (!c1 || !r1 || !c2 || !r2) return false
  const startCol = colToIndex(c1)
  const endCol = colToIndex(c2)
  const startRow = parseInt(r1, 10) - 1
  const endRow = parseInt(r2, 10) - 1
  for (const cell of cells) {
    if (
      cell.rowIndex >= Math.min(startRow, endRow) &&
      cell.rowIndex <= Math.max(startRow, endRow) &&
      cell.columnIndex >= Math.min(startCol, endCol) &&
      cell.columnIndex <= Math.max(startCol, endCol)
    ) {
      return true
    }
  }
  return false
}

function colToIndex(letters: string): number {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.toUpperCase().charCodeAt(i) - 64)
  }
  return result - 1
}
