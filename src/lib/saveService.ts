/**
 * Legacy save service.
 *
 * In SheetForge this wrote a single jsonb blob to the old workbooks table.
 * R4 replaced that with a normalized schema (workbooks + sheets + cells).
 * The new persistence path lives in src/features/workbook/cellPersistence.ts
 * (server actions, called from the grid debounce); this legacy module now
 * only writes to localStorage for offline / unauth fallback. It never hits
 * Supabase, so it cannot 400 against the new schema.
 *
 * Once SpreadsheetGrid is fully migrated to the cellPersistence path
 * (R6.x), this file can be removed.
 */

export interface WorkbookSaveData {
  id?: string
  name: string
  data: unknown
}

function serializeError(err: unknown): Record<string, unknown> | string {
  if (!err) return 'unknown'
  if (typeof err === 'string') return err
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  if (typeof err === 'object') {
    // Supabase errors expose message/code/details/hint as own enumerable
    // strings, but they're not JSON-stringify-friendly when nested. Pull
    // the common fields explicitly.
    const e = err as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of ['message', 'code', 'details', 'hint', 'status']) {
      if (e[key] !== undefined) out[key] = e[key]
    }
    return Object.keys(out).length > 0 ? out : { raw: String(err) }
  }
  return String(err)
}

function logSaveServiceError(message: string, err: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    const consoleRef = Reflect.get(globalThis, 'console') as
      | { error?: (label: string, value: unknown) => void }
      | null
    consoleRef?.error?.(message, serializeError(err))
  }
}

function localStorageKey(name: string): string {
  return `quiksheets_workbook_${name}`
}

/**
 * Save the FortuneSheet workbook blob to localStorage. Returns null
 * because the legacy id-tracking semantics no longer apply.
 *
 * If you need real Supabase persistence, use the server actions in
 * src/features/workbook/* instead.
 */
export async function saveWorkbook(
  payload: WorkbookSaveData
): Promise<{ id: string } | null> {
  try {
    if (typeof window === 'undefined') return null
    window.localStorage.setItem(
      localStorageKey(payload.name),
      JSON.stringify({ ...payload, savedAt: new Date().toISOString() })
    )
    return null
  } catch (err) {
    logSaveServiceError('Save failed:', err)
    return null
  }
}

/**
 * Read a previously saved blob from localStorage. Returns null if not
 * present or unreadable.
 */
export async function loadWorkbook(name: string): Promise<WorkbookSaveData | null> {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(localStorageKey(name))
    if (!raw) return null
    return JSON.parse(raw) as WorkbookSaveData
  } catch (err) {
    logSaveServiceError('Load failed:', err)
    return null
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSave(payload: WorkbookSaveData): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    saveWorkbook(payload).catch((err) => logSaveServiceError('Auto-save failed:', err))
  }, 30_000)
}
