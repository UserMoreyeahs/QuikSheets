'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { assertCanEdit, assertCanRead } from '@/lib/permissions'

const snapshotSchema = z.object({
  workbookId: z.string().uuid(),
  label: z.string().trim().max(120).optional(),
  snapshot: z.unknown(),
})

const restoreSchema = z.object({
  workbookId: z.string().uuid(),
  versionId: z.string().uuid(),
  note: z.string().trim().max(120).optional(),
})

export interface WorkbookVersion {
  id: string
  label: string | null
  createdAt: string
}

export async function listWorkbookVersionsAction(workbookId: string): Promise<WorkbookVersion[]> {
  // Read access required — return an empty list (not an error) when the
  // caller lacks permission, so the version-history panel renders quietly.
  try {
    await assertCanRead(workbookId)
  } catch {
    return []
  }
  const supabase = await getServerSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('workbook_versions')
    .select('id, label, created_at')
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: false })
    .limit(100)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    label: (r.label as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

export async function snapshotWorkbookAction(input: z.input<typeof snapshotSchema>) {
  const parsed = snapshotSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid snapshot' }

  const ctx = await assertCanEdit(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const insertPayload: Record<string, unknown> = {
    workbook_id: parsed.data.workbookId,
    snapshot_json: parsed.data.snapshot ?? {},
    created_by: ctx.userId,
  }
  if (parsed.data.label) insertPayload.label = parsed.data.label

  const { data, error } = await supabase
    .from('workbook_versions')
    .insert(insertPayload)
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, id: data.id as string }
}

/**
 * Restore a previous workbook version.
 *
 * Flow:
 *  1. Verify the caller can edit the workbook.
 *  2. Fetch the snapshot JSON for the requested versionId.
 *  3. Write a "pre-restore" snapshot of the current state so the
 *     restore itself is reversible.
 *  4. Return the snapshot payload to the client; SpreadsheetGrid
 *     calls `replaceGridSheets` to apply it, and the normal save
 *     pipeline writes the restored cells back to Supabase on its
 *     next debounced flush.
 *  5. Record an audit_logs row.
 */
export async function restoreWorkbookVersionAction(input: z.input<typeof restoreSchema>) {
  const parsed = restoreSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const ctx = await assertCanEdit(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const service = getServiceRoleSupabase()
  if (!service) return { ok: false as const, error: 'Supabase service role not configured' }

  const { data: version } = await service
    .from('workbook_versions')
    .select('snapshot_json')
    .eq('id', parsed.data.versionId)
    .eq('workbook_id', parsed.data.workbookId)
    .maybeSingle()
  if (!version) return { ok: false as const, error: 'Version not found' }

  // Take an "undo" snapshot of the current cells before we overwrite.
  // Best-effort: a failure here should not block the restore itself.
  try {
    const { data: currentCells } = await service
      .from('cells')
      .select('sheet_id, row_index, column_index, raw_value, formula')
      .eq('workbook_id', parsed.data.workbookId)
      .limit(50_000)
    await service.from('workbook_versions').insert({
      workbook_id: parsed.data.workbookId,
      snapshot_json: { cells: currentCells ?? [], restored_from: parsed.data.versionId },
      label: 'Auto-snapshot before restore',
      created_by: ctx.userId,
    })
  } catch {
    // Soft-fail — proceed with the restore.
  }

  // Audit trail.
  await service.from('audit_logs').insert({
    workbook_id: parsed.data.workbookId,
    actor_id: ctx.userId,
    action: 'workbook.restore',
    target_type: 'workbook_version',
    target_id: parsed.data.versionId,
    metadata_json: { note: parsed.data.note ?? '' },
  })

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, snapshot: version.snapshot_json }
}
