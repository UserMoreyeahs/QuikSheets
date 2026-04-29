import { supabase } from '@/lib/supabase'

export interface WorkbookSaveData {
  id?: string
  name: string
  data: unknown
}

function logSaveServiceError(message: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    const consoleRef = Reflect.get(globalThis, 'console') as
      | { error?: (label: string, value: unknown) => void }
      | null
    consoleRef?.error?.(message, err)
  }
}

/**
 * Saves workbook to Supabase.
 * Creates a new record if no id, updates existing if id present.
 * Falls back to localStorage when Supabase is not configured or
 * the user is not authenticated — never throws.
 */
export async function saveWorkbook(
  payload: WorkbookSaveData
): Promise<{ id: string } | null> {
  try {
    // No Supabase client — save to localStorage
    if (!supabase) {
      localStorage.setItem(
        `sheetforge_workbook_${payload.name}`,
        JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
      )
      return null
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // No authenticated user — fall back to localStorage
    if (!user) {
      localStorage.setItem(
        `sheetforge_workbook_${payload.name}`,
        JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
      )
      return null
    }

    if (payload.id) {
      // Update existing record
      const { error } = await supabase
        .from('workbooks')
        .update({ name: payload.name, data: payload.data })
        .eq('id', payload.id)
        .eq('owner_id', user.id)

      if (error) throw error
      return { id: payload.id }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('workbooks')
        .insert({ name: payload.name, data: payload.data, owner_id: user.id })
        .select('id')
        .single()

      if (error) throw error
      return { id: (data as { id: string }).id }
    }
  } catch (err) {
    logSaveServiceError('Save failed:', err)
    return null
  }
}

/**
 * Loads a workbook from Supabase by id.
 */
export async function loadWorkbook(id: string): Promise<WorkbookSaveData | null> {
  try {
    if (!supabase) return null

    const { data, error } = await supabase
      .from('workbooks')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as WorkbookSaveData
  } catch (err) {
    logSaveServiceError('Load failed:', err)
    return null
  }
}

/**
 * Debounced auto-save — waits 30 seconds after the last call before saving.
 * Implemented inline (not via the shared debounce util) to correctly type
 * the async payload without generic constraint gymnastics.
 */
let _saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(payload: WorkbookSaveData): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    saveWorkbook(payload).catch((err) => logSaveServiceError('Auto-save failed:', err))
  }, 30_000)
}
