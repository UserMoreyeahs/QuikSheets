'use client'

/**
 * SelectionPane — Page Layout > Arrange (Bring Forward / Send Backward / Selection Pane).
 *
 * Lists every inserted overlay (shapes / icons / text boxes from the
 * overlay store) and every inserted image, sorted by current z-order
 * (front-most at the top of the list, matching Excel's behaviour).
 *
 * Each row has:
 *   - up arrow (Bring Forward) — moves item to a higher z-index
 *   - down arrow (Send Backward) — moves item to a lower z-index
 *   - X (Delete) — removes the item from the sheet
 *
 * All three Arrange ribbon buttons (Bring Forward, Send Backward,
 * Selection Pane) open this pane — picking the per-item action is
 * easier than tracking a separate "selected" overlay state across
 * multiple stores.
 */

import { X, ArrowUp, ArrowDown, Shapes, Image as ImageIcon, Type, Sparkles } from 'lucide-react'
import { useSelectionPaneStore } from '../store/selectionPaneStore'
import { useOverlayStore } from '@/features/overlays/store/overlayStore'
import { useImageStore } from '@/features/images/store/imageStore'

interface PaneItem {
  id: string
  kind: 'shape' | 'icon' | 'textbox' | 'image'
  label: string
  /** Index within the source store (used for relative reorder ops). */
  source: 'overlay' | 'image'
}

export function SelectionPane() {
  const open = useSelectionPaneStore((s) => s.open)
  const close = useSelectionPaneStore((s) => s.closePane)

  const overlays = useOverlayStore((s) => s.overlays)
  const removeOverlay   = useOverlayStore((s) => s.removeOverlay)
  const bringOvForward  = useOverlayStore((s) => s.bringForward)
  const sendOvBackward  = useOverlayStore((s) => s.sendBackward)

  const images = useImageStore((s) => s.images)
  const removeImage   = useImageStore((s) => s.removeImage)
  const bringImgForward  = useImageStore((s) => s.bringForward)
  const sendImgBackward  = useImageStore((s) => s.sendBackward)

  if (!open) return null

  // Build a unified list. Front-most (last in render order) first.
  const items: PaneItem[] = []
  // Render order: images then overlays — but overlays may sit above or
  // below depending on z-index. For the pane we show overlays on top
  // (they have z-index 30 by default) and images below.
  for (let i = overlays.length - 1; i >= 0; i--) {
    const o = overlays[i]!
    items.push({
      id: o.id,
      kind: o.kind,
      label:
        o.kind === 'shape' ? `Shape · ${o.shape}` :
        o.kind === 'icon'  ? `Icon · ${o.iconName}` :
        `Text · ${(o.text || '(empty)').slice(0, 24)}`,
      source: 'overlay',
    })
  }
  for (let i = images.length - 1; i >= 0; i--) {
    const img = images[i]!
    items.push({
      id: img.id,
      kind: 'image',
      label: `Image · ${img.name.slice(0, 30)}`,
      source: 'image',
    })
  }

  function iconFor(kind: PaneItem['kind']): React.ReactNode {
    switch (kind) {
      case 'shape':    return <Shapes className="h-3.5 w-3.5 text-amber-500" />
      case 'icon':     return <Sparkles className="h-3.5 w-3.5 text-blue-500" />
      case 'textbox':  return <Type className="h-3.5 w-3.5 text-zinc-500" />
      case 'image':    return <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />
    }
  }

  function up(item: PaneItem) {
    if (item.source === 'overlay') bringOvForward(item.id)
    else                            bringImgForward(item.id)
  }
  function down(item: PaneItem) {
    if (item.source === 'overlay') sendOvBackward(item.id)
    else                            sendImgBackward(item.id)
  }
  function remove(item: PaneItem) {
    if (item.source === 'overlay') removeOverlay(item.id)
    else                            removeImage(item.id)
  }

  return (
    <div
      className="absolute right-2 top-2 z-40 flex w-72 flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="selection-pane"
      style={{ maxHeight: '70vh' }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
          Selection Pane
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Close selection pane"
          title="Close"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] italic text-zinc-400">
            No overlays on this sheet. Insert a shape, icon, text box,
            or image to see it here.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                {iconFor(item.kind)}
                <span className="flex-1 truncate text-[11px] text-zinc-700 dark:text-zinc-200" title={item.label}>
                  {item.label}
                </span>
                <button type="button" onClick={() => up(item)} aria-label="Bring forward" title="Bring forward" className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => down(item)} aria-label="Send backward" title="Send backward" className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(item)} aria-label="Remove" title="Remove" className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
