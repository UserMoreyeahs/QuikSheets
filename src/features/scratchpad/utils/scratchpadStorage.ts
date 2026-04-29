export const STORAGE_KEY = 'quiksheets_scratchpad'

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getScratchpadKey(sheetId: string): string {
  return `${STORAGE_KEY}:${sheetId}`
}

export function saveScratchpad(sheetId: string, data: unknown): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(getScratchpadKey(sheetId), JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function loadScratchpad<T = unknown>(sheetId: string): T | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(getScratchpadKey(sheetId))
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function clearScratchpad(sheetId: string): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.removeItem(getScratchpadKey(sheetId))
    return true
  } catch {
    return false
  }
}
