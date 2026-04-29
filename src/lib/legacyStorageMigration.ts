const MIGRATION_FLAG = 'quiksheets_legacy_migration_v1'
const LEGACY_PREFIX = 'sheetforge_'
const NEW_PREFIX = 'quiksheets_'

export function migrateLegacyStorageKeys(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG) === 'done') return

    const legacyKeys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(LEGACY_PREFIX)) legacyKeys.push(key)
    }

    for (const key of legacyKeys) {
      const value = window.localStorage.getItem(key)
      if (value === null) continue
      const newKey = NEW_PREFIX + key.slice(LEGACY_PREFIX.length)
      if (window.localStorage.getItem(newKey) === null) {
        window.localStorage.setItem(newKey, value)
      }
      window.localStorage.removeItem(key)
    }

    window.localStorage.setItem(MIGRATION_FLAG, 'done')
  } catch {
    // localStorage unavailable — silently skip
  }
}
