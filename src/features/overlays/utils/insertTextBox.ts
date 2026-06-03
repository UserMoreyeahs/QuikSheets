'use client'

/**
 * insertTextBox — Insert > Text Box ribbon handler.
 *
 * Drops a blank, editable text-box overlay near the active cell. The
 * overlay auto-enters edit mode on first render so users can start
 * typing immediately. Different from Comment because:
 *   - lives outside the cell grid (floating, draggable)
 *   - has its own font/colour controls
 *   - isn't tied to a cell value
 */

import { toast } from 'sonner'
import { useOverlayStore } from '../store/overlayStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'

export function insertTextBox(): void {
  const { selectedCell } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  if (!activeSheetId) {
    toast.error('No active sheet.')
    return
  }
  useOverlayStore.getState().addTextbox({
    kind: 'textbox',
    text: '',
    fontSize: 14,
    textColor: '#1f2937',
    backgroundColor: '#fef9c3', // sticky-note yellow
    bold: false,
    italic: false,
    sheetId: activeSheetId,
    anchorRow: selectedCell?.row ?? 0,
    anchorCol: selectedCell?.col ?? 0,
  })
  toast.success('Text box inserted — double-click to edit')
}
