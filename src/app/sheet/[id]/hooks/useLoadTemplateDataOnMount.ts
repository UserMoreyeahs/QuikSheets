'use client'

import { useEffect } from 'react'
import type { Sheet } from '@fortune-sheet/core'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { SheetTab } from '@/types/sheet.types'

/**
 * If this workbook was created from a template, drain the
 * `quiksheets_template_data:<workbookId>` localStorage key on mount and
 * hydrate the sheet tabs + grid data with it. The local key is removed
 * after first read so re-mounts (e.g. HMR) don't replay the template.
 *
 * Failures are silently swallowed — corrupt template data falls back to
 * the default empty sheet (matching the original inline effect).
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useLoadTemplateDataOnMount(workbookId: string): void {
  useEffect(() => {
    try {
      const templateKey = `quiksheets_template_data:${workbookId}`
      const raw = window.localStorage.getItem(templateKey)
      if (!raw) return

      const templateSheets = JSON.parse(raw) as Sheet[]
      window.localStorage.removeItem(templateKey)

      const templateTabs: SheetTab[] = templateSheets.map((sheet, index) => ({
        id: typeof sheet.id === 'string' ? sheet.id : `sheet${index + 1}`,
        name: sheet.name,
        color: null,
        isHidden: false,
        order: index,
      }))
      const firstId = templateTabs[0]?.id ?? 'sheet1'

      useWorkbookStore.getState().replaceSheets(templateTabs, firstId)
      useSheetStore.getState().replaceGridSheets(templateSheets)
    } catch {
      // Template data missing or corrupt; start with default sheet.
    }
    // Single-shot on mount — workbookId is captured by closure intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
