'use client'

/**
 * OverlaysLayer — renders Shape / Icon / Text-Box overlays.
 *
 * Each overlay is a cell-anchored, draggable, resizable floating panel —
 * the same chrome as ImagesLayer / ChartsLayer. The body changes based
 * on overlay.kind:
 *
 *   shape   → inline SVG with palette + stroke controls in the title bar
 *   icon    → lucide icon at the requested colour
 *   textbox → contentEditable text body with B / I / size / colour
 *
 * Why a single layer instead of three?
 *   - One ErrorBoundary, one mount in page.tsx, one z-index.
 *   - Common drag/resize handler shared via FloatingChrome.
 *   - Overlays render in insertion order regardless of kind, so the user
 *     gets a predictable stacking model.
 */

import { useEffect, useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import { X, GripVertical, Bold, Italic } from 'lucide-react'
import {
  useOverlayStore,
  type InsertedOverlay,
  type ShapeOverlay,
  type IconOverlay,
  type TextboxOverlay,
} from '../store/overlayStore'
import { useSheetStore } from '@/store/sheetStore'
import { useGridScroll, cellToPixelPosition } from '@/features/grid/hooks/useGridScroll'
import { colIndexToLetter } from '@/lib/cellAddress'
import { CURATED_ICON_NAMES } from '../utils/curatedIcons'

export function OverlaysLayer() {
  const overlays = useOverlayStore((s) => s.overlays)
  if (overlays.length === 0) return null
  return <OverlaysLayerInner />
}

function OverlaysLayerInner() {
  const overlays = useOverlayStore((s) => s.overlays)
  const remove = useOverlayStore((s) => s.removeOverlay)
  const move = useOverlayStore((s) => s.moveOverlay)
  const resize = useOverlayStore((s) => s.resizeOverlay)
  const update = useOverlayStore((s) => s.updateOverlay)
  const gridSheets = useSheetStore((s) => s.gridSheets)
  const scrollOffset = useGridScroll()

  return (
    <>
      {overlays.map((ov) => {
        const sheet = gridSheets.find((s) => s.id === ov.sheetId) ?? gridSheets.find((s) => s.status === 1)
        if (!sheet) return null
        const anchorPos = cellToPixelPosition(ov.anchorRow, ov.anchorCol, scrollOffset)
        return (
          <FloatingChrome
            key={ov.id}
            overlay={ov}
            anchorLabel={`${colIndexToLetter(ov.anchorCol)}${ov.anchorRow + 1}`}
            x={anchorPos.x + ov.x}
            y={anchorPos.y + ov.y}
            onClose={() => remove(ov.id)}
            onMove={(x, y) => move(ov.id, x - anchorPos.x, y - anchorPos.y)}
            onResize={(w, h) => resize(ov.id, w, h)}
            onUpdate={(patch) => update(ov.id, patch)}
          />
        )
      })}
    </>
  )
}

interface ChromeProps {
  overlay: InsertedOverlay
  anchorLabel: string
  x: number
  y: number
  onClose: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number) => void
  onUpdate: (patch: Partial<InsertedOverlay>) => void
}

function FloatingChrome({ overlay, anchorLabel, x, y, onClose, onMove, onResize, onUpdate }: ChromeProps) {
  const { id, w, h } = overlay
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | null>(null)

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: x, baseY: y }
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd, { once: true })
  }
  function onDragMove(e: MouseEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    onMove(Math.max(0, dragRef.current.baseX + dx), Math.max(0, dragRef.current.baseY + dy))
  }
  function onDragEnd() {
    dragRef.current = null
    document.removeEventListener('mousemove', onDragMove)
  }

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, baseW: w, baseH: h }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd, { once: true })
  }
  function onResizeMove(e: MouseEvent) {
    if (!resizeRef.current) return
    const dw = e.clientX - resizeRef.current.startX
    const dh = e.clientY - resizeRef.current.startY
    onResize(
      Math.max(60, resizeRef.current.baseW + dw),
      Math.max(40, resizeRef.current.baseH + dh),
    )
  }
  function onResizeEnd() {
    resizeRef.current = null
    document.removeEventListener('mousemove', onResizeMove)
  }

  useEffect(() => () => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mousemove', onResizeMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kindLabel = overlay.kind === 'shape' ? overlay.shape : overlay.kind === 'icon' ? overlay.iconName : 'Text'

  return (
    <div
      style={{ left: x, top: y, width: w }}
      className="absolute z-30 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-overlay-id={id}
      data-overlay-kind={overlay.kind}
    >
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move items-center justify-between border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100 px-2.5 py-1 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800/80"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <GripVertical className="h-3 w-3 shrink-0 text-zinc-400" />
          <span className="truncate text-[11px] font-semibold capitalize text-zinc-700 dark:text-zinc-200">
            {kindLabel}
          </span>
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {anchorLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Remove ${overlay.kind}`}
          title={`Remove ${overlay.kind}`}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div style={{ height: h - 28 }} className="relative bg-white dark:bg-zinc-900">
        {overlay.kind === 'shape' && <ShapeBody overlay={overlay} onUpdate={onUpdate} />}
        {overlay.kind === 'icon' && <IconBody overlay={overlay} />}
        {overlay.kind === 'textbox' && <TextboxBody overlay={overlay} onUpdate={onUpdate} />}
      </div>
      <div
        onMouseDown={onResizeStart}
        aria-label="Resize"
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, rgb(161 161 170) 40%, rgb(161 161 170) 50%, transparent 50%, transparent 65%, rgb(161 161 170) 65%, rgb(161 161 170) 75%, transparent 75%)',
        }}
      />
    </div>
  )
}

// ─── Shape body ─────────────────────────────────────────────────────────

function ShapeBody({ overlay, onUpdate }: { overlay: ShapeOverlay; onUpdate: (p: Partial<InsertedOverlay>) => void }) {
  const { shape, fillColor, strokeColor, strokeWidth } = overlay
  // Body uses 100% width / height so the SVG scales with resize.
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {shape === 'rect' && (
          <rect x="3" y="3" width="94" height="54" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
        )}
        {shape === 'ellipse' && (
          <ellipse cx="50" cy="30" rx="47" ry="27" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
        )}
        {shape === 'line' && (
          <line x1="5" y1="30" x2="95" y2="30" stroke={strokeColor} strokeWidth={strokeWidth} />
        )}
        {shape === 'arrow' && (
          <g stroke={strokeColor} strokeWidth={strokeWidth} fill={strokeColor}>
            <line x1="5" y1="30" x2="85" y2="30" />
            <polygon points="85,22 95,30 85,38" />
          </g>
        )}
        {shape === 'triangle' && (
          <polygon points="50,5 95,55 5,55" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
        )}
        {shape === 'diamond' && (
          <polygon points="50,3 97,30 50,57 3,30" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
        )}
      </svg>
      {/* Tiny colour swatches in the bottom-left so users can recolor without
          opening a modal. Stays out of the way otherwise. */}
      <div className="pointer-events-auto absolute bottom-1 left-1 flex gap-1 rounded bg-white/80 px-1 py-0.5 opacity-0 transition-opacity hover:opacity-100 dark:bg-zinc-800/80">
        <input
          type="color"
          aria-label="Fill"
          title="Fill"
          value={fillColor}
          onChange={(e) => onUpdate({ fillColor: e.target.value })}
          className="h-3 w-3 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="color"
          aria-label="Stroke"
          title="Stroke"
          value={strokeColor}
          onChange={(e) => onUpdate({ strokeColor: e.target.value })}
          className="h-3 w-3 cursor-pointer border-0 bg-transparent p-0"
        />
      </div>
    </div>
  )
}

// ─── Icon body ──────────────────────────────────────────────────────────

function IconBody({ overlay }: { overlay: IconOverlay }) {
  // Look up the lucide icon by name. If the name isn't in the curated set
  // we still try the full lucide namespace as a fallback so future
  // additions don't break.
  const LucideIcon =
    (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[
      overlay.iconName
    ] ?? Icons.HelpCircle
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LucideIcon size={Math.min(overlay.w, overlay.h) * 0.7} color={overlay.color} strokeWidth={1.5} />
    </div>
  )
}

// ─── Textbox body ───────────────────────────────────────────────────────

function TextboxBody({
  overlay,
  onUpdate,
}: {
  overlay: TextboxOverlay
  onUpdate: (p: Partial<InsertedOverlay>) => void
}) {
  const [editing, setEditing] = useState(overlay.text === '')
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (editing && ref.current) ref.current.focus()
  }, [editing])

  return (
    <div
      style={{ background: overlay.backgroundColor }}
      className="h-full w-full p-1"
    >
      <div className="pointer-events-auto absolute right-1 top-7 flex gap-1 rounded bg-white/80 px-1 py-0.5 text-[10px] opacity-0 transition-opacity hover:opacity-100 dark:bg-zinc-800/80">
        <button
          type="button"
          onClick={() => onUpdate({ bold: !overlay.bold })}
          aria-label="Bold"
          title="Bold"
          className={`rounded p-0.5 ${overlay.bold ? 'bg-blue-100 text-blue-700' : 'text-zinc-600'}`}
        >
          <Bold className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ italic: !overlay.italic })}
          aria-label="Italic"
          title="Italic"
          className={`rounded p-0.5 ${overlay.italic ? 'bg-blue-100 text-blue-700' : 'text-zinc-600'}`}
        >
          <Italic className="h-3 w-3" />
        </button>
        <input
          type="color"
          aria-label="Text color"
          title="Text color"
          value={overlay.textColor}
          onChange={(e) => onUpdate({ textColor: e.target.value })}
          className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="number"
          aria-label="Font size"
          title="Font size"
          min={8}
          max={48}
          value={overlay.fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) || 14 })}
          className="h-4 w-10 rounded border border-zinc-200 px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {editing ? (
        <textarea
          ref={ref}
          value={overlay.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onBlur={() => setEditing(false)}
          placeholder="Type text…"
          style={{
            color: overlay.textColor,
            fontSize: overlay.fontSize,
            fontWeight: overlay.bold ? 700 : 400,
            fontStyle: overlay.italic ? 'italic' : 'normal',
            background: 'transparent',
          }}
          className="h-full w-full resize-none border-0 outline-none"
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          role="button"
          tabIndex={0}
          style={{
            color: overlay.textColor,
            fontSize: overlay.fontSize,
            fontWeight: overlay.bold ? 700 : 400,
            fontStyle: overlay.italic ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          className="h-full w-full cursor-text overflow-hidden"
          title="Double-click to edit"
        >
          {overlay.text || <span className="italic text-zinc-400">Double-click to edit</span>}
        </div>
      )}
    </div>
  )
}

export { CURATED_ICON_NAMES }
