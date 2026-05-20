'use client'

/**
 * ImagesLayer — Excel-style inserted images.
 *
 * Mirrors ChartsLayer: each inserted image renders as an absolute-positioned
 * panel inside the grid container, draggable by the title bar, resizable
 * from the bottom-right corner, and removable via the X.
 *
 * Images are stored in-memory as data URLs (lost on reload), matching the
 * existing inserted-chart lifecycle.
 */

import { useEffect, useRef } from 'react'
import { X, GripVertical, Image as ImageIcon } from 'lucide-react'
import { useImageStore } from '../store/imageStore'
import { useSheetStore } from '@/store/sheetStore'
import { useGridScroll, cellToPixelPosition } from '@/features/grid/hooks/useGridScroll'
import { colIndexToLetter } from '@/lib/cellAddress'

export function ImagesLayer() {
  const images = useImageStore((s) => s.images)
  if (images.length === 0) return null
  return <ImagesLayerInner />
}

function ImagesLayerInner() {
  const images = useImageStore((s) => s.images)
  const removeImage = useImageStore((s) => s.removeImage)
  const moveImage = useImageStore((s) => s.moveImage)
  const resizeImage = useImageStore((s) => s.resizeImage)
  const gridSheets = useSheetStore((s) => s.gridSheets)
  const scrollOffset = useGridScroll()

  return (
    <>
      {images.map((img) => {
        const sheet = gridSheets.find((s) => s.id === img.sheetId) ?? gridSheets.find((s) => s.status === 1)
        if (!sheet) return null
        const anchorPos = cellToPixelPosition(img.anchorRow, img.anchorCol, scrollOffset)
        const anchorLabel = `${colIndexToLetter(img.anchorCol)}${img.anchorRow + 1}`
        return (
          <ImageFloatingPanel
            key={img.id}
            id={img.id}
            src={img.src}
            name={img.name}
            anchor={anchorLabel}
            x={anchorPos.x + img.x}
            y={anchorPos.y + img.y}
            w={img.w}
            h={img.h}
            onClose={() => removeImage(img.id)}
            onMove={(x, y) => moveImage(img.id, x - anchorPos.x, y - anchorPos.y)}
            onResize={(w, h) => resizeImage(img.id, w, h)}
          />
        )
      })}
    </>
  )
}

interface PanelProps {
  id: string
  src: string
  name: string
  anchor: string
  x: number
  y: number
  w: number
  h: number
  onClose: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number) => void
}

function ImageFloatingPanel({ id, src, name, anchor, x, y, w, h, onClose, onMove, onResize }: PanelProps) {
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
      Math.max(80, resizeRef.current.baseW + dw),
      Math.max(60, resizeRef.current.baseH + dh),
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

  return (
    <div
      style={{ left: x, top: y, width: w }}
      className="absolute z-30 overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-image-id={id}
    >
      <div
        onMouseDown={onDragStart}
        className="flex cursor-move items-center justify-between border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100 px-2.5 py-1.5 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-800/80"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <GripVertical className="h-3 w-3 shrink-0 text-zinc-400" />
          <ImageIcon className="h-3 w-3 shrink-0 text-blue-500" />
          <span className="truncate text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
            {name}
          </span>
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {anchor}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Remove image"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="bg-white dark:bg-zinc-900" style={{ height: h - 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          draggable={false}
          className="h-full w-full select-none object-contain"
        />
      </div>
      <div
        onMouseDown={onResizeStart}
        aria-label="Resize image"
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, rgb(161 161 170) 40%, rgb(161 161 170) 50%, transparent 50%, transparent 65%, rgb(161 161 170) 65%, rgb(161 161 170) 75%, transparent 75%)',
        }}
      />
    </div>
  )
}
