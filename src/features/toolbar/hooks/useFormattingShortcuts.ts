'use client'

import { useEffect, useCallback } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toast } from 'sonner'

type MergeCapable = {
  mergeCells?: (ranges: unknown[], type: string, opts?: { id?: string }) => void
  cancelMerge?: (ranges: unknown[], opts?: { id?: string }) => void
}

export function useFormattingShortcuts() {
  const { activeFormatting, applyFormatToSelection, gridInstance, selectedRange } =
    useSheetStore()
  const { activeSheetId } = useWorkbookStore()

  const mergeCells = useCallback(() => {
    if (!selectedRange || !gridInstance) {
      toast.message('Select a range of cells to merge')
      return
    }
    const startRow = Math.min(selectedRange.start.row, selectedRange.end.row)
    const endRow = Math.max(selectedRange.start.row, selectedRange.end.row)
    const startCol = Math.min(selectedRange.start.col, selectedRange.end.col)
    const endCol = Math.max(selectedRange.start.col, selectedRange.end.col)
    if (startRow === endRow && startCol === endCol) {
      toast.message('Select multiple cells to merge')
      return
    }
    ;(gridInstance as unknown as MergeCapable).mergeCells?.(
      [{ row: [startRow, endRow], column: [startCol, endCol] }],
      'merge-all',
      { id: activeSheetId }
    )
  }, [selectedRange, gridInstance, activeSheetId])

  const unmergeCells = useCallback(() => {
    if (!selectedRange || !gridInstance) return
    ;(gridInstance as unknown as MergeCapable).cancelMerge?.(
      [
        {
          row: [selectedRange.start.row, selectedRange.end.row],
          column: [selectedRange.start.col, selectedRange.end.col],
        },
      ],
      { id: activeSheetId }
    )
  }, [selectedRange, gridInstance, activeSheetId])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

      if (!ctrlOrCmd) return

      // ── Ctrl+Shift combinations ──
      if (e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'm':
            e.preventDefault()
            mergeCells()
            return
          case 'u':
            // Ctrl+Shift+U = Unmerge (not plain Ctrl+U which is underline)
            e.preventDefault()
            unmergeCells()
            return
        }
        return
      }

      // ── Ctrl-only combinations ──
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
        case '5':
          // Ctrl+5 toggles strikethrough — Excel parity.
          e.preventDefault()
          applyFormatToSelection({ strikethrough: !activeFormatting.strikethrough })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFormatting, applyFormatToSelection, mergeCells, unmergeCells])
}
