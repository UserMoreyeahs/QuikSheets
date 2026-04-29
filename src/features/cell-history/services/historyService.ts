import { supabase } from '@/lib/supabase'

export interface CellHistoryEntry {
  id: string
  workbook_id: string
  sheet_id: string
  cell_address: string
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  changed_at: string
}

export interface RestoredCellResult {
  historyEntry: CellHistoryEntry
  previousValue: string | null
  restoredValue: string | null
}

function isLikelyUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function normalizeHistoryValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

/**
 * Record a single cell-edit event in the cell_history table.
 *
 * Until R6.x wires the FortuneSheet grid to the new sheets table, the
 * sheetId arriving here is a FortuneSheet string id ("sheet1") and not
 * a real sheets.id UUID. The R4 schema requires a UUID FK, so we early-
 * return for non-UUID inputs. The caller never depends on the result
 * being non-null, so a silent skip is safe.
 *
 * Errors during the actual insert are also swallowed silently — the dev
 * error overlay treats console.error as a blocking dialog, and we don't
 * want a transient Supabase blip to interrupt cell editing. Real
 * persistence + history will be reimplemented end-to-end via R6.x.
 */
export async function recordCellChange(
  workbookId: string | null | undefined,
  sheetId: string,
  cellAddress: string,
  oldValue: unknown,
  newValue: unknown
): Promise<CellHistoryEntry | null> {
  const oldHistoryValue = normalizeHistoryValue(oldValue)
  const newHistoryValue = normalizeHistoryValue(newValue)
  if (oldHistoryValue === newHistoryValue) return null
  if (!supabase || !workbookId || !isLikelyUuid(workbookId)) return null
  if (!isLikelyUuid(sheetId)) return null

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('cell_history')
      .insert({
        workbook_id: workbookId,
        sheet_id: sheetId,
        cell_address: cellAddress,
        old_value: oldHistoryValue,
        new_value: newHistoryValue,
        changed_by: user.id,
      })
      .select('*')
      .single()
    if (error) return null
    return data as CellHistoryEntry
  } catch {
    return null
  }
}

export async function getCellHistory(
  workbookId: string | null | undefined,
  sheetId: string,
  cellAddress: string
): Promise<CellHistoryEntry[]> {
  if (!supabase || !workbookId || !isLikelyUuid(workbookId)) return []
  if (!isLikelyUuid(sheetId)) return []

  try {
    const { data, error } = await supabase
      .from('cell_history')
      .select('*')
      .eq('workbook_id', workbookId)
      .eq('sheet_id', sheetId)
      .eq('cell_address', cellAddress)
      .order('changed_at', { ascending: false })
    if (error) return []
    return (data ?? []) as CellHistoryEntry[]
  } catch {
    return []
  }
}

export async function restoreCell(_historyId: string): Promise<RestoredCellResult | null> {
  // The legacy restore path read `workbooks.data` which the R4 normalized
  // schema no longer has; the new restore flow lives in
  // src/features/version-history/actions.ts and operates on rows in the
  // `cells` table. Until the grid is migrated to that path (R6.x), surface
  // null instead of error-ing.
  return null
}
