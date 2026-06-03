'use client'

/**
 * Fill operations (Up / Left / Down / Right / Series) and Freeze Panes.
 * Extracted from cellOps.ts — Wave 4d.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { promptDialog } from '@/components/PromptDialog'
import { getInstance } from './shared'

// ─── Freeze Panes ────────────────────────────────────────────────────────
// FortuneSheet API: freeze(type: 'row'|'column'|'both', range: {row, column}, options?)
//   type='row',    range={row:1, column:0} → freeze top row only
//   type='column', range={row:0, column:1} → freeze first column only
//   type='both',   range={row:R, column:C} → freeze rows 0..R-1 AND cols 0..C-1

type FreezeFn = (
  type: 'row' | 'column' | 'both',
  range: { row: number; column: number },
  options?: { id?: string },
) => void

export function freezeTopRow(): void {
  const inst = getInstance()
  if (!inst) { toast.error('Grid not ready'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    ;(inst as unknown as { freeze: FreezeFn }).freeze('row', { row: 1, column: 0 }, { id: activeSheetId })
    toast.success('Top row frozen')
  } catch (e) {
    toast.error(`Couldn't freeze: ${String(e)}`)
  }
}

export function freezeFirstColumn(): void {
  const inst = getInstance()
  if (!inst) { toast.error('Grid not ready'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    ;(inst as unknown as { freeze: FreezeFn }).freeze('column', { row: 0, column: 1 }, { id: activeSheetId })
    toast.success('First column frozen')
  } catch (e) {
    toast.error(`Couldn't freeze: ${String(e)}`)
  }
}

export function freezePanesAtActiveCell(): void {
  const inst = getInstance()
  const { selectedCell } = useSheetStore.getState()
  if (!inst || !selectedCell) { toast.error('Select a cell first'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  // If active cell is A1, treat as freeze top-row (Excel default behaviour)
  if (selectedCell.row === 0 && selectedCell.col === 0) {
    return freezeTopRow()
  }
  try {
    ;(inst as unknown as { freeze: FreezeFn }).freeze(
      'both',
      { row: selectedCell.row, column: selectedCell.col },
      { id: activeSheetId },
    )
    toast.success(`Frozen at row ${selectedCell.row + 1}, column ${selectedCell.col + 1}`)
  } catch (e) {
    toast.error(`Couldn't freeze: ${String(e)}`)
  }
}

export function unfreezePanes(): void {
  const inst = getInstance()
  if (!inst) { toast.error('Grid not ready'); return }
  const { activeSheetId } = useWorkbookStore.getState()
  try {
    // Setting row=0,column=0 unfreezes
    ;(inst as unknown as { freeze: FreezeFn }).freeze('row', { row: 0, column: 0 }, { id: activeSheetId })
    toast.success('Panes unfrozen')
  } catch (e) {
    toast.error(`Couldn't unfreeze: ${String(e)}`)
  }
}

// ─── Fill variants (Up / Left / Down / Right / Series) ───────────────────
// Mirrors fillDown / fillRight from useExcelKeyboardShortcuts but flipped.

function fillFromBoundary(direction: 'up' | 'left'): void {
  const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range with the source at the bottom (Up) or right (Left)')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  const sheet = gridSheets[selectedCell.sheet]
  if (!sheet) return

  try {
    if (direction === 'up') {
      for (let c = sc; c <= ec; c++) {
        const sourceCell = sheet.data?.[er]?.[c] as { v?: unknown; f?: string } | undefined
        if (!sourceCell) continue
        const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
        for (let r = sr; r < er; r++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, source as unknown)
        }
      }
      toast.success('Filled up')
    } else {
      for (let r = sr; r <= er; r++) {
        const sourceCell = sheet.data?.[r]?.[ec] as { v?: unknown; f?: string } | undefined
        if (!sourceCell) continue
        const source = sourceCell.f ? `=${sourceCell.f}` : sourceCell.v
        for (let c = sc; c < ec; c++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, source as unknown)
        }
      }
      toast.success('Filled left')
    }
  } catch (e) {
    toast.error(`Fill failed: ${String(e)}`)
  }
}

export function fillUp(): void {
  fillFromBoundary('up')
}
export function fillLeft(): void {
  fillFromBoundary('left')
}

/** Fill Down — copy top row of selection into all rows below. */
export function fillDown(): void {
  const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range first')
    return
  }
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
    toast.success('Filled down')
  } catch (e) {
    toast.error(`Fill Down failed: ${String(e)}`)
  }
}

/** Fill Right — copy leftmost column of selection rightward. */
export function fillRight(): void {
  const { selectedCell, selectedRange, gridInstance, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range first')
    return
  }
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
    toast.success('Filled right')
  } catch (e) {
    toast.error(`Fill Right failed: ${String(e)}`)
  }
}

/**
 * Fill Series — Excel's "Series…" dialog with start/step/stop. Simplified to
 * a 3-prompt flow (start value, step, stop). Generates an arithmetic series
 * down or right depending on selection orientation.
 */
export async function fillSeries(): Promise<void> {
  const { selectedCell, selectedRange, gridInstance } = useSheetStore.getState()
  if (!selectedCell || !selectedRange || !gridInstance) {
    toast.message('Select a range first')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)

  const startInput = await promptDialog({
    title: 'Fill series — start value',
    defaultValue: '1',
    inputType: 'number',
  })
  if (startInput === null) return
  const stepInput = await promptDialog({
    title: 'Fill series — step',
    message: 'Each subsequent cell increments by this amount.',
    defaultValue: '1',
    inputType: 'number',
  })
  if (stepInput === null) return
  const start = Number(startInput)
  const step = Number(stepInput)
  if (!Number.isFinite(start) || !Number.isFinite(step)) {
    toast.error('Enter valid numbers')
    return
  }

  try {
    if (er - sr >= ec - sc) {
      // Vertical orientation: fill down through the column(s)
      for (let c = sc; c <= ec; c++) {
        let v = start
        for (let r = sr; r <= er; r++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, v)
          v += step
        }
      }
    } else {
      // Horizontal: fill right
      for (let r = sr; r <= er; r++) {
        let v = start
        for (let c = sc; c <= ec; c++) {
          ;(gridInstance as unknown as { setCellValue: (r: number, c: number, v: unknown) => void })
            .setCellValue(r, c, v)
          v += step
        }
      }
    }
    toast.success(`Series: ${start}, ${start + step}, ${start + 2 * step}…`)
  } catch (e) {
    toast.error(`Series fill failed: ${String(e)}`)
  }
}
