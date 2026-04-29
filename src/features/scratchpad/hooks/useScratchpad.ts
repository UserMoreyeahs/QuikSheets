'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Sheet } from '@fortune-sheet/core'
import {
  clearScratchpad,
  loadScratchpad,
  saveScratchpad,
} from '@/features/scratchpad/utils/scratchpadStorage'

const SCRATCHPAD_ROWS = 100
const SCRATCHPAD_COLUMNS = 20

function createScratchpadData(sheetId: string): Sheet[] {
  return [
    {
      id: `scratchpad-${sheetId}`,
      name: 'Private Scratchpad',
      order: 0,
      status: 1,
      hide: 0,
      row: SCRATCHPAD_ROWS,
      column: SCRATCHPAD_COLUMNS,
      data: Array.from({ length: SCRATCHPAD_ROWS }, () =>
        Array.from({ length: SCRATCHPAD_COLUMNS }, () => null)
      ),
    },
  ]
}

function normalizeScratchpadData(sheetId: string, data: Sheet[] | null): Sheet[] {
  const sheet = data?.[0]
  if (!sheet) return createScratchpadData(sheetId)

  return [
    {
      ...sheet,
      id: typeof sheet.id === 'string' ? sheet.id : `scratchpad-${sheetId}`,
      name: sheet.name || 'Private Scratchpad',
      order: 0,
      status: 1,
      hide: 0,
      row: Math.max(sheet.row ?? SCRATCHPAD_ROWS, SCRATCHPAD_ROWS),
      column: Math.max(sheet.column ?? SCRATCHPAD_COLUMNS, SCRATCHPAD_COLUMNS),
    },
  ]
}

interface UseScratchpadOptions {
  sheetId: string | null | undefined
  mainSheetData: Sheet | null | undefined
}

export function useScratchpad({ sheetId, mainSheetData }: UseScratchpadOptions) {
  const storageSheetId = sheetId || 'default'
  const [isOpen, setIsOpen] = useState(false)
  const [scratchpadData, setScratchpadData] = useState<Sheet[]>(() =>
    createScratchpadData(storageSheetId)
  )
  const [hydratedSheetId, setHydratedSheetId] = useState<string | null>(null)
  const [shouldPersist, setShouldPersist] = useState(false)

  useEffect(() => {
    const storedData = loadScratchpad<Sheet[]>(storageSheetId)
    setScratchpadData(normalizeScratchpadData(storageSheetId, storedData))
    setHydratedSheetId(storageSheetId)
    setShouldPersist(false)
  }, [storageSheetId])

  useEffect(() => {
    if (hydratedSheetId !== storageSheetId) return
    if (!shouldPersist) return

    const saveTimer = window.setTimeout(() => {
      saveScratchpad(storageSheetId, scratchpadData)
    }, 2000)

    return () => window.clearTimeout(saveTimer)
  }, [hydratedSheetId, scratchpadData, shouldPersist, storageSheetId])

  const updateScratchpadData = useCallback((nextData: Sheet[]) => {
    setScratchpadData(nextData)
    setShouldPersist(true)
  }, [])

  const toggleScratchpad = useCallback(() => {
    setIsOpen((current) => !current)
  }, [])

  const closeScratchpad = useCallback(() => {
    setIsOpen(false)
  }, [])

  const clearScratchpadData = useCallback(() => {
    clearScratchpad(storageSheetId)
    setScratchpadData(createScratchpadData(storageSheetId))
    setShouldPersist(false)
  }, [storageSheetId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key !== '`' && event.code !== 'Backquote') return

      event.preventDefault()
      toggleScratchpad()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleScratchpad])

  return useMemo(
    () => ({
      clearScratchpadData,
      closeScratchpad,
      isOpen,
      mainSheetData,
      scratchpadData,
      setScratchpadData: updateScratchpadData,
      storageSheetId,
      toggleScratchpad,
    }),
    [
      clearScratchpadData,
      closeScratchpad,
      isOpen,
      mainSheetData,
      scratchpadData,
      storageSheetId,
      toggleScratchpad,
      updateScratchpadData,
    ]
  )
}
