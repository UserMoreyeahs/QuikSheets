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

function serializeError(err: unknown): Record<string, unknown> | string {
  if (!err) return 'unknown'
  if (typeof err === 'string') return err
  if (err instanceof Error) return { name: err.name, message: err.message }
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of ['message', 'code', 'details', 'hint', 'status']) {
      if (e[key] !== undefined) out[key] = e[key]
    }
    return Object.keys(out).length > 0 ? out : { raw: String(err) }
  }
  return String(err)
}

function logHistoryError(message: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    const consoleRef = Reflect.get(globalThis, 'console') as
      | { error?: (label: string, value: unknown) => void }
      | null
    consoleRef?.error?.(message, serializeError(err))
  }
}

function normalizeHistoryValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

// (Legacy restoreCellInWorkbookData was removed when restoreCell became a
// no-op; the new restore path operates on the cells table via R12 actions.)

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
  // R4 schema requires sheet_id to be a UUID referencing sheets(id). The
  // FortuneSheet engine still uses string ids like "sheet1" until R6.x wires
  // the grid to the new sheets table. Until then, silently skip recording so
  // we don't flood the console with FK-constraint errors on every keystroke.
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

    if (error) throw error
    return data as CellHistoryEntry
  } catch (err) {
    logHistoryError('Cell history record failed:', err)
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

    if (error) throw error
    return (data ?? []) as CellHistoryEntry[]
  } catch (err) {
    logHistoryError('Cell history fetch failed:', err)
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
