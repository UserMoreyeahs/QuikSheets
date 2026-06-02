'use client'

/**
 * Format Painter — captures the active cell's full format object and applies
 * it to the next cell/range the user clicks on.
 * Extracted from cellOps.ts — Wave 4f.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { getInstance } from './shared'

export interface CapturedFormat {
  bg?: string
  fc?: string
  bl?: 0 | 1
  it?: 0 | 1
  un?: 0 | 1
  cl?: 0 | 1
  fs?: number
  ff?: string
  ht?: number
  vt?: number
  tb?: string
  ct?: { fa: string; t: 'n' | 's' } | null
  tr?: string
}

let painterArmed: { format: CapturedFormat; cleanup: () => void } | null = null

export function startFormatPainter(): void {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) {
    toast.message('Select a source cell first, then click Format Painter')
    return
  }
  // Capture format from the current cell
  const sheets = useSheetStore.getState().gridSheets
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = sheets.find((s) => s.id === activeSheetId)
  const cell = sheet?.data?.[selectedCell.row]?.[selectedCell.col] as Record<string, unknown> | undefined
  if (!cell) {
    toast.message('Selected cell has no formatting to copy')
    return
  }
  const captured: CapturedFormat = {}
  for (const key of ['bg','fc','bl','it','un','cl','fs','ff','ht','vt','tb','ct','tr'] as const) {
    if (cell[key] !== undefined) (captured as Record<string, unknown>)[key] = cell[key]
  }

  if (painterArmed) painterArmed.cleanup()

  // Show a visual cue (cursor changes)
  document.body.classList.add('quiksheets-format-painter-active')

  function handleClickArm(_e: MouseEvent) {
    // Wait one tick so the new selection has propagated, then apply
    setTimeout(() => {
      const inst2 = useSheetStore.getState().gridInstance
      const next = useSheetStore.getState().selectedCell
      const range = useSheetStore.getState().selectedRange
      if (!inst2 || !next) {
        cleanup()
        return
      }
      const sr = range ? Math.min(range.start.row, range.end.row) : next.row
      const er = range ? Math.max(range.start.row, range.end.row) : next.row
      const sc = range ? Math.min(range.start.col, range.end.col) : next.col
      const ec = range ? Math.max(range.start.col, range.end.col) : next.col
      const targetRange = [{ row: [sr, er], column: [sc, ec] }]
      try {
        for (const [attr, value] of Object.entries(captured)) {
          ;(inst2 as unknown as {
            setCellFormatByRange: (attr: string, value: unknown, range: unknown) => void
          }).setCellFormatByRange(attr, value, targetRange)
        }
        toast.success('Format applied')
      } catch (e) {
        toast.error(`Format paint failed: ${String(e)}`)
      }
      cleanup()
    }, 50)
  }

  function cleanup() {
    document.body.classList.remove('quiksheets-format-painter-active')
    document.removeEventListener('mousedown', handleClickArm, true)
    painterArmed = null
  }

  document.addEventListener('mousedown', handleClickArm, true)
  painterArmed = { format: captured, cleanup }
  toast('Format Painter armed', { description: 'Click a cell or range to apply the copied format.' })
}
