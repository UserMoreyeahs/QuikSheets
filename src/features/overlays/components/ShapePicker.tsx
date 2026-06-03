'use client'

/**
 * ShapePicker — Insert > Shapes dialog.
 *
 * Shows the 6 SVG shape primitives in a horizontal palette. Click one
 * and we insert a floating shape overlay anchored to the active cell
 * (or A1 fallback).
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useShapePickerStore, useOverlayStore, type ShapeKind } from '../store/overlayStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toast } from 'sonner'

const SHAPES: Array<{ kind: ShapeKind; label: string; svg: React.ReactNode }> = [
  { kind: 'rect',     label: 'Rectangle', svg: <rect x="6" y="6" width="36" height="24" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} /> },
  { kind: 'ellipse',  label: 'Ellipse',   svg: <ellipse cx="24" cy="18" rx="18" ry="12" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} /> },
  { kind: 'line',     label: 'Line',      svg: <line x1="6" y1="18" x2="42" y2="18" stroke="#2563eb" strokeWidth={2.5} /> },
  { kind: 'arrow',    label: 'Arrow',     svg: <g stroke="#2563eb" strokeWidth={2.5} fill="#2563eb"><line x1="6" y1="18" x2="36" y2="18" /><polygon points="36,12 44,18 36,24" /></g> },
  { kind: 'triangle', label: 'Triangle',  svg: <polygon points="24,4 44,32 4,32" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} /> },
  { kind: 'diamond',  label: 'Diamond',   svg: <polygon points="24,3 45,18 24,33 3,18" fill="#dbeafe" stroke="#2563eb" strokeWidth={2} /> },
]

export function ShapePicker() {
  const open = useShapePickerStore((s) => s.open)
  const close = useShapePickerStore((s) => s.closePicker)
  const addShape = useOverlayStore((s) => s.addShape)

  function insert(kind: ShapeKind) {
    const { selectedCell } = useSheetStore.getState()
    const { activeSheetId } = useWorkbookStore.getState()
    if (!activeSheetId) {
      toast.error('No active sheet.')
      return
    }
    const row = selectedCell?.row ?? 0
    const col = selectedCell?.col ?? 0
    addShape({
      kind: 'shape',
      shape: kind,
      sheetId: activeSheetId,
      anchorRow: row,
      anchorCol: col,
      fillColor: '#dbeafe',
      strokeColor: '#2563eb',
      strokeWidth: 2,
    })
    toast.success(`${kind.charAt(0).toUpperCase() + kind.slice(1)} inserted`)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Shape</DialogTitle>
          <DialogDescription>
            Pick a shape to insert as a floating, draggable, resizable
            overlay anchored to the active cell.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 pt-2">
          {SHAPES.map((s) => (
            <button
              key={s.kind}
              type="button"
              onClick={() => insert(s.kind)}
              className="flex flex-col items-center gap-1 rounded border border-zinc-200 px-2 py-3 text-[12px] hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
            >
              <svg viewBox="0 0 48 36" className="h-9 w-12">{s.svg}</svg>
              {s.label}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
