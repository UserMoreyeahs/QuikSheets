'use client'

/**
 * Page-layout cell operations: orientation / margins / paper size / print area.
 *
 * Extracted from src/features/ribbon/utils/cellOps.ts (Wave 4 split).
 * All ops write to usePrintSettingsStore so File > Print and exportToPDF
 * pick up the user's choices.
 *
 * Public API is re-exported from cellOps.ts for back-compat — all existing
 * call sites stay byte-identical.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { promptDialog } from '@/components/PromptDialog'
import {
  usePrintSettingsStore,
  type Orientation,
  type MarginPreset,
  type PaperSize,
} from '@/features/page-layout/printSettingsStore'
import { colIndexToLetter } from './shared'

export function setOrientationPreset(orientation: Orientation): void {
  usePrintSettingsStore.getState().setOrientation(orientation)
  toast.success(`Orientation: ${orientation === 'portrait' ? 'Portrait' : 'Landscape'}`)
}

export async function setMarginPreset(preset: MarginPreset): Promise<void> {
  if (preset === 'custom') {
    // 4 sequential prompts. Cleaner than a 4-input modal for a rare action.
    const top = await promptDialog({
      title: 'Top margin (inches)',
      defaultValue: '0.75',
      inputType: 'number',
    })
    if (top === null) return
    const right = await promptDialog({
      title: 'Right margin (inches)',
      defaultValue: '0.7',
      inputType: 'number',
    })
    if (right === null) return
    const bottom = await promptDialog({
      title: 'Bottom margin (inches)',
      defaultValue: '0.75',
      inputType: 'number',
    })
    if (bottom === null) return
    const left = await promptDialog({
      title: 'Left margin (inches)',
      defaultValue: '0.7',
      inputType: 'number',
    })
    if (left === null) return
    const margins = {
      top: parseFloat(top),
      right: parseFloat(right),
      bottom: parseFloat(bottom),
      left: parseFloat(left),
    }
    if (Object.values(margins).some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error('Enter valid non-negative numbers')
      return
    }
    usePrintSettingsStore.getState().setCustomMargins(margins)
    toast.success(`Custom margins applied`)
  } else {
    usePrintSettingsStore.getState().setMarginPreset(preset)
    toast.success(`Margins: ${preset.charAt(0).toUpperCase() + preset.slice(1)}`)
  }
}

export function setPaperSizePreset(size: PaperSize): void {
  usePrintSettingsStore.getState().setPaperSize(size)
  toast.success(`Paper size: ${size.toUpperCase()}`)
}

/** Set Print Area to the current selection (or current cell if no range). */
export function setPrintAreaFromSelection(): void {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) {
    toast.error('Select a range first')
    return
  }
  const sr = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const er = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const sc = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const ec = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const range = `${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`
  usePrintSettingsStore.getState().setPrintArea(range)
  toast.success(`Print area set to ${range}`)
}

export function clearPrintArea(): void {
  usePrintSettingsStore.getState().setPrintArea(null)
  toast.success('Print area cleared')
}
