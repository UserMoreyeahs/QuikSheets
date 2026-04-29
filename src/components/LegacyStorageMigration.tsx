'use client'

import { useEffect } from 'react'
import { migrateLegacyStorageKeys } from '@/lib/legacyStorageMigration'

export function LegacyStorageMigration() {
  useEffect(() => {
    migrateLegacyStorageKeys()
  }, [])
  return null
}
