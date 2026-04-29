import { createCell, getCellFormulaBarValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { fromCellNotation } from '@/lib/cellAddress'
import { supabase } from '@/lib/supabase'
import type { CellMatrix, Sheet } from '@fortune-sheet/core'

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

function logHistoryError(message: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    const consoleRef = Reflect.get(globalThis, 'console') as
      | { error?: (label: string, value: unknown) => void }
      | null
    consoleRef?.error?.(message, err)
  }
}

function normalizeHistoryValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function cloneWorkbookData(data: unknown): unknown {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }

  return JSON.parse(JSON.stringify(data)) as unknown
}

function getWorkbookSheets(data: unknown): Sheet[] {
  if (!Array.isArray(data)) return []
  return data as Sheet[]
}

function restoreCellInWorkbookData(
  workbookData: unknown,
  sheetId: string,
  cellAddress: string,
  value: string | null
): { data: unknown; previousValue: string | null } {
  const nextData = cloneWorkbookData(workbookData)
  const sheets = getWorkbookSheets(nextData)
  const sheetIndex = sheets.findIndex((sheet) => sheet.id === sheetId)
  const sheet = sheets[sheetIndex]
  if (!sheet) return { data: nextData, previousValue: null }

  const { row, col } = fromCellNotation(cellAddress)
  const matrix = getSheetMatrix(sheet).map((sheetRow) => [...(sheetRow ?? [])]) as CellMatrix
  const previousValue = normalizeHistoryValue(getCellFormulaBarValue(matrix[row]?.[col] ?? null))

  if (!matrix[row]) {
    matrix[row] = []
  }
  matrix[row]![col] = createCell(value)

  const maxColumns = matrix.reduce((max, sheetRow) => Math.max(max, sheetRow?.length ?? 0), 0)
  sheets[sheetIndex] = {
    ...sheet,
    data: matrix,
    row: Math.max(sheet.row ?? 0, matrix.length, 1),
    column: Math.max(sheet.column ?? 0, maxColumns, 1),
  }
  delete sheets[sheetIndex].celldata

  return { data: nextData, previousValue }
}

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

export async function restoreCell(historyId: string): Promise<RestoredCellResult | null> {
  if (!supabase) return null

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: entryData, error: entryError } = await supabase
      .from('cell_history')
      .select('*')
      .eq('id', historyId)
      .single()

    if (entryError) throw entryError
    const historyEntry = entryData as CellHistoryEntry

    const { data: workbookData, error: workbookError } = await supabase
      .from('workbooks')
      .select('data')
      .eq('id', historyEntry.workbook_id)
      .single()

    if (workbookError) throw workbookError

    const { data: restoredWorkbookData, previousValue } = restoreCellInWorkbookData(
      (workbookData as { data: unknown }).data,
      historyEntry.sheet_id,
      historyEntry.cell_address,
      historyEntry.old_value
    )

    const { error: updateError } = await supabase
      .from('workbooks')
      .update({ data: restoredWorkbookData })
      .eq('id', historyEntry.workbook_id)

    if (updateError) throw updateError

    await recordCellChange(
      historyEntry.workbook_id,
      historyEntry.sheet_id,
      historyEntry.cell_address,
      previousValue,
      historyEntry.old_value
    )

    return {
      historyEntry,
      previousValue,
      restoredValue: historyEntry.old_value,
    }
  } catch (err) {
    logHistoryError('Cell history restore failed:', err)
    return null
  }
}
