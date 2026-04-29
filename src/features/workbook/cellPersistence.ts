'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { colIndexToLetter } from '@/lib/cellAddress'

const cellInput = z.object({
  workbookId: z.string().uuid(),
  sheetId: z.string().uuid(),
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().nonnegative(),
  rawValue: z.string().nullable(),
  formula: z.string().nullable(),
})

const upsertCellsSchema = z.object({
  cells: z.array(cellInput).max(5_000),
})

export interface UpsertCellsResult {
  ok: boolean
  saved: number
  error?: string
}

/**
 * Server-side batch upsert of cell values. Called by the debounced grid save
 * pipeline. RLS guarantees the caller can only write cells in workbooks they
 * are owner/editor of.
 */
export async function upsertCellsAction(input: { cells: z.input<typeof cellInput>[] }): Promise<UpsertCellsResult> {
  const parsed = upsertCellsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, saved: 0, error: 'Invalid cell payload' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false, saved: 0, error: 'Supabase not configured' }

  const rows = parsed.data.cells.map((c) => ({
    workbook_id: c.workbookId,
    sheet_id: c.sheetId,
    row_index: c.rowIndex,
    column_index: c.columnIndex,
    address: `${colIndexToLetter(c.columnIndex)}${c.rowIndex + 1}`,
    raw_value: c.rawValue,
    formula: c.formula,
  }))

  const { error, count } = await supabase
    .from('cells')
    .upsert(rows, { onConflict: 'sheet_id,row_index,column_index', count: 'exact' })

  if (error) return { ok: false, saved: 0, error: error.message }
  return { ok: true, saved: count ?? rows.length }
}
