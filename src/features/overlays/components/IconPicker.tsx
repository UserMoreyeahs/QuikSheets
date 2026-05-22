'use client'

/**
 * IconPicker — Insert > Icons dialog.
 *
 * 6×6 grid of curated lucide icons + a free-text "Other…" input so
 * users can request any icon by typing its lucide name. Clicked icon
 * becomes a floating overlay anchored to the active cell.
 */

import { useState } from 'react'
import * as Icons from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useIconPickerStore, useOverlayStore } from '../store/overlayStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toast } from 'sonner'
import { CURATED_ICON_NAMES } from '../utils/curatedIcons'

type LucideIconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

export function IconPicker() {
  const open = useIconPickerStore((s) => s.open)
  const close = useIconPickerStore((s) => s.closePicker)
  const addIcon = useOverlayStore((s) => s.addIcon)
  const [other, setOther] = useState('')
  const [color, setColor] = useState('#2563eb')

  function insert(iconName: string) {
    const { selectedCell } = useSheetStore.getState()
    const { activeSheetId } = useWorkbookStore.getState()
    if (!activeSheetId) {
      toast.error('No active sheet.')
      return
    }
    const Cmp = (Icons as unknown as Record<string, LucideIconCmp>)[iconName]
    if (!Cmp) {
      toast.error(`No lucide icon named "${iconName}". Browse https://lucide.dev/icons for the full list.`)
      return
    }
    addIcon({
      kind: 'icon',
      iconName,
      color,
      sheetId: activeSheetId,
      anchorRow: selectedCell?.row ?? 0,
      anchorCol: selectedCell?.col ?? 0,
    })
    toast.success(`${iconName} icon inserted`)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Icon</DialogTitle>
          <DialogDescription>
            Pick from the 36 most common icons, or type any lucide icon
            name in the &ldquo;Other&rdquo; field. Inserts as a floating overlay
            anchored to the active cell.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pt-2">
          <label htmlFor="icon-color" className="text-[11px] uppercase tracking-wider text-zinc-500">Color</label>
          <input
            id="icon-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-10 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
          />
        </div>

        <div className="grid grid-cols-6 gap-1 pt-2">
          {CURATED_ICON_NAMES.map((name) => {
            const Cmp = (Icons as unknown as Record<string, LucideIconCmp>)[name]
            if (!Cmp) return null
            return (
              <button
                key={name}
                type="button"
                onClick={() => insert(name)}
                title={name}
                className="flex h-12 w-full items-center justify-center rounded border border-transparent hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
              >
                <Cmp size={20} color={color} strokeWidth={1.6} />
              </button>
            )
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (other.trim()) insert(other.trim())
          }}
          className="flex items-center gap-2 pt-3"
        >
          <input
            type="text"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Other lucide name (e.g. Lightbulb)…"
            className="h-8 flex-1 rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!other.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Insert
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
