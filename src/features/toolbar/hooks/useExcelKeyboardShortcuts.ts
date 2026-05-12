'use client'

/**
 * Excel-faithful keyboard shortcuts that augment the formatting ones.
 * Add new bindings here, not in useFormattingShortcuts (which is focused
 * on Bold/Italic/Underline/Merge).
 *
 * Implemented shortcuts:
 *   F2           — Edit active cell (focus formula bar with value loaded)
 *   F9           — Recalculate workbook
 *   Shift+F3     — Open Insert Function dialog
 *   Ctrl+F3      — Open Name Manager dialog
 *   Ctrl+`       — Toggle Show Formulas (display formulas vs values)
 *   Ctrl+;       — Insert today's date as a value
 *   Ctrl+:       — Insert current time as a value
 *   Ctrl+Shift+L — Toggle filter
 *   Alt+=        — AutoSum
 *   Ctrl+D       — Fill down from top row of selection
 *   Ctrl+R       — Fill right from leftmost column of selection
 *   Ctrl+Space   — Select entire column(s)
 *   Shift+Space  — Select entire row(s)
 *   Ctrl+T       — Format selection as Excel Table (Light Blue palette)
 *   Ctrl+P       — Print (export to PDF + open browser print dialog)
 *   Ctrl+9       — Hide selected row(s)
 *   Ctrl+Shift+9 — Unhide rows in/around selection
 *   Ctrl+0       — Hide selected column(s)
 *   Ctrl+Shift+0 — Unhide columns in/around selection
 */

import { useEffect } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { applyTablePalette, toggleShowFormulas } from '@/features/ribbon/utils/cellOps'
import { useInsertFunctionStore } from '@/features/formula-engine/stores/insertFunctionStore'
import { useNamedRangesStore } from '@/features/named-ranges/namedRangesStore'

interface Options {
  onToggleFilter?: () => void
  onAutoSum?: () => void
  onPrint?: () => void
}

function formatToday(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

function formatNow(): string {
  const d = new Date()
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${mm} ${ampm}`
}

export function useExcelKeyboardShortcuts(opts: Options = {}) {
  const { onToggleFilter, onAutoSum, onPrint } = opts

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip when an input/textarea/contentEditable is focused
      const target = e.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      const isEditable =
        target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrl = isMac ? e.metaKey : e.ctrlKey

      // F2 — Edit active cell. Excel parity: enter edit mode with cursor at end.
      // Our equivalent: focus the formula bar pre-loaded with the cell's value, and
      // mark the cell as "editing" so the bar shows the cell address. The user
      // gets a fully-functional editing experience identical in outcome to F2.
      if (e.key === 'F2' && !ctrl && !e.altKey && !e.shiftKey && !isEditable) {
        const state = useSheetStore.getState()
        const { selectedCell, gridInstance, gridSheets } = state
        const { activeSheetId } = useWorkbookStore.getState()
        void activeSheetId
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        try {
          // Read the current value or formula
          const sheet = gridSheets[selectedCell.sheet]
          const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as
            | { v?: unknown; f?: string; m?: unknown }
            | undefined
          const currentText = cell?.f
            ? `=${cell.f}`
            : cell?.v != null
              ? String(cell.v)
              : ''

          state.setFormulaBarValue(currentText)
          state.setEditingCell(selectedCell)

          // Focus the formula bar input + place caret at end (Excel default)
          requestAnimationFrame(() => {
            const input = document.querySelector('.formula-bar-input') as HTMLInputElement | null
            if (input) {
              input.focus()
              const len = input.value.length
              input.setSelectionRange(len, len)
            }
          })
        } catch { /* swallow */ }
        return
      }

      // Alt+= — AutoSum
      if (e.altKey && e.key === '=' && onAutoSum) {
        e.preventDefault()
        onAutoSum()
        return
      }

      // Shift+F3 — Insert Function dialog
      if (e.key === 'F3' && e.shiftKey && !ctrl && !e.altKey && !isEditable) {
        e.preventDefault()
        useInsertFunctionStore.getState().setOpen(true)
        return
      }

      // Ctrl+F3 — Name Manager
      if (e.key === 'F3' && ctrl && !e.shiftKey && !e.altKey && !isEditable) {
        e.preventDefault()
        useNamedRangesStore.getState().setDialogOpen(true)
        return
      }

      // Ctrl+` — Toggle Show Formulas
      if (e.key === '`' && ctrl && !e.shiftKey && !e.altKey && !isEditable) {
        e.preventDefault()
        toggleShowFormulas()
        return
      }

      // F9 — Recalculate (force a re-render via updateSheet)
      if (e.key === 'F9' && !ctrl && !e.shiftKey && !e.altKey && !isEditable) {
        e.preventDefault()
        try {
          const { gridInstance } = useSheetStore.getState()
          if (!gridInstance) return
          const all = (gridInstance as unknown as { getAllSheets: () => unknown[] }).getAllSheets()
          ;(gridInstance as unknown as { updateSheet: (s: unknown[]) => void }).updateSheet(all)
        } catch { /* swallow */ }
        return
      }

      // Shift+Space — Select entire row(s) for current selection. (NO ctrl)
      if (!ctrl && e.shiftKey && !e.altKey && e.code === 'Space' && !isEditable) {
        const { selectedCell, selectedRange, gridInstance } = useSheetStore.getState()
        const { activeSheetId } = useWorkbookStore.getState()
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        const sr = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
        const er = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
        try {
          ;(gridInstance as unknown as {
            setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
          }).setSelection([{ row: [sr, er], column: [0, 25] }], { id: activeSheetId })
        } catch { /* swallow */ }
        return
      }

      if (!ctrl) return

      // Ctrl+Space — Select entire column(s)
      if (!e.shiftKey && !e.altKey && e.code === 'Space') {
        const { selectedCell, selectedRange, gridInstance } = useSheetStore.getState()
        const { activeSheetId } = useWorkbookStore.getState()
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        const sc = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
        const ec = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
        try {
          ;(gridInstance as unknown as {
            setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
          }).setSelection([{ row: [0, 99], column: [sc, ec] }], { id: activeSheetId })
        } catch { /* swallow */ }
        return
      }

      // Ctrl+P — Print (export PDF and let browser handle print)
      if (!e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p' && onPrint) {
        e.preventDefault()
        onPrint()
        return
      }

      // Ctrl+T — Format selection as Excel Table
      if (!e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        applyTablePalette()
        return
      }

      // Ctrl+9 — Hide selected rows
      if (!e.shiftKey && !e.altKey && e.key === '9') {
        const { selectedCell, selectedRange, gridInstance } = useSheetStore.getState()
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        const sr = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
        const er = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
        try {
          const idx = Array.from({ length: er - sr + 1 }, (_, i) => String(sr + i))
          ;(gridInstance as unknown as {
            hideRowOrColumn: (info: string[], type: 'row' | 'column') => void
          }).hideRowOrColumn(idx, 'row')
        } catch { /* swallow */ }
        return
      }

      // Ctrl+Shift+9 — Unhide all rows
      if (e.shiftKey && !e.altKey && (e.key === '9' || e.key === '(')) {
        e.preventDefault()
        try {
          const { gridInstance } = useSheetStore.getState()
          if (!gridInstance) return
          const idx = Array.from({ length: 1000 }, (_, i) => String(i))
          ;(gridInstance as unknown as {
            showRowOrColumn: (info: string[], type: 'row' | 'column') => void
          }).showRowOrColumn(idx, 'row')
        } catch { /* swallow */ }
        return
      }

      // Ctrl+0 — Hide selected columns
      if (!e.shiftKey && !e.altKey && e.key === '0') {
        const { selectedCell, selectedRange, gridInstance } = useSheetStore.getState()
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        const sc = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
        const ec = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
        try {
          const idx = Array.from({ length: ec - sc + 1 }, (_, i) => String(sc + i))
          ;(gridInstance as unknown as {
            hideRowOrColumn: (info: string[], type: 'row' | 'column') => void
          }).hideRowOrColumn(idx, 'column')
        } catch { /* swallow */ }
        return
      }

      // Ctrl+Shift+0 — Unhide all columns
      if (e.shiftKey && !e.altKey && (e.key === '0' || e.key === ')')) {
        e.preventDefault()
        try {
          const { gridInstance } = useSheetStore.getState()
          if (!gridInstance) return
          const idx = Array.from({ length: 100 }, (_, i) => String(i))
          ;(gridInstance as unknown as {
            showRowOrColumn: (info: string[], type: 'row' | 'column') => void
          }).showRowOrColumn(idx, 'column')
        } catch { /* swallow */ }
        return
      }

      // Ctrl+D — Fill down: copy top row of selection into all rows below within the selection
      if (!e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
        if (!selectedCell || !selectedRange || !gridInstance) return
        e.preventDefault()
        const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
        const er = Math.max(selectedRange.start.row, selectedRange.end.row)
        const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
        const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
        const sheet = gridSheets[selectedCell.sheet]
        if (!sheet) return
        try {
          for (let c = sc; c <= ec; c++) {
            const sourceCell = sheet.data?.[sr]?.[c] as { v?: unknown; f?: string } | undefined
            if (!sourceCell) continue
            const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
            for (let r = sr + 1; r <= er; r++) {
              ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
                .setCellValue(r, c, source as unknown)
            }
          }
        } catch { /* swallow */ }
        return
      }

      // Ctrl+R — Fill right: copy leftmost column of selection into columns to the right
      if (!e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r') {
        const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
        if (!selectedCell || !selectedRange || !gridInstance) return
        e.preventDefault()
        const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
        const er = Math.max(selectedRange.start.row, selectedRange.end.row)
        const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
        const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
        const sheet = gridSheets[selectedCell.sheet]
        if (!sheet) return
        try {
          for (let r = sr; r <= er; r++) {
            const sourceCell = sheet.data?.[r]?.[sc] as { v?: unknown; f?: string } | undefined
            if (!sourceCell) continue
            const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
            for (let c = sc + 1; c <= ec; c++) {
              ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
                .setCellValue(r, c, source as unknown)
            }
          }
        } catch { /* swallow */ }
        return
      }

      // Ctrl+; — Insert today's date
      if (!e.shiftKey && !e.altKey && e.key === ';') {
        const { selectedCell, gridInstance } = useSheetStore.getState()
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        try {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: string) => void })
            .setCellValue(selectedCell.row, selectedCell.col, formatToday())
        } catch { /* swallow */ }
        return
      }

      // Ctrl+: (Shift+;) — Insert current time
      if (e.shiftKey && !e.altKey && (e.key === ':' || e.key === ';')) {
        const { selectedCell, gridInstance } = useSheetStore.getState()
        if (!selectedCell || !gridInstance) return
        e.preventDefault()
        try {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: string) => void })
            .setCellValue(selectedCell.row, selectedCell.col, formatNow())
        } catch { /* swallow */ }
        return
      }

      // Ctrl+Shift+L — Toggle filter
      if (e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l' && onToggleFilter) {
        e.preventDefault()
        onToggleFilter()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggleFilter, onAutoSum, onPrint])
}
