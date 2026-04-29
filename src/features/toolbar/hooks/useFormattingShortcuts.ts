'use client'

import { useEffect } from 'react'
import { useSheetStore } from '@/store/sheetStore'

export function useFormattingShortcuts() {
  const { activeFormatting, applyFormatToSelection } = useSheetStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

      if (!ctrlOrCmd) return

      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          // Apply bold to both toolbar state AND the selected cell(s)
          applyFormatToSelection({ bold: !activeFormatting.bold })
          break
        case 'i':
          e.preventDefault()
          applyFormatToSelection({ italic: !activeFormatting.italic })
          break
        case 'u':
          e.preventDefault()
          applyFormatToSelection({ underline: !activeFormatting.underline })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFormatting, applyFormatToSelection])
}
