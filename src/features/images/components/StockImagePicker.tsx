'use client'

/**
 * StockImagePicker — Insert > Pictures > Stock Images.
 *
 * Curated grid of free-to-use Unsplash photos. No API key, no runtime
 * fetch — the URLs in curatedStockPhotos.ts hotlink Unsplash's CDN
 * directly (allowed under the Unsplash License). Click a tile to insert
 * the full-resolution image as a floating overlay anchored to the active
 * cell.
 *
 * Category tabs at the top filter the grid. The dialog stays open until
 * the user dismisses it, so they can drop multiple photos in sequence
 * (Excel's Stock Images dialog behaves the same).
 */

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useStockImagePickerStore } from '../store/stockImagePickerStore'
import { useImageStore } from '../store/imageStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import {
  STOCK_PHOTOS,
  STOCK_PHOTO_CATEGORIES,
  type StockPhoto,
  type StockPhotoCategory,
} from '../utils/curatedStockPhotos'

export function StockImagePicker() {
  const open = useStockImagePickerStore((s) => s.open)
  const close = useStockImagePickerStore((s) => s.closePicker)
  const [category, setCategory] = useState<StockPhotoCategory | 'All'>('All')

  function insert(photo: StockPhoto) {
    const sheet = useSheetStore.getState()
    const { activeSheetId } = useWorkbookStore.getState()
    const sheetId =
      activeSheetId ??
      sheet.gridSheets.find((s) => s.status === 1)?.id ??
      sheet.gridSheets[0]?.id
    if (!sheetId) {
      toast.error('No active sheet — cannot insert image')
      return
    }
    // Stock photos are landscape; default panel size matches that ratio.
    useImageStore.getState().addImage({
      src: photo.full,
      name: `${photo.alt} — by ${photo.photographer}`,
      sheetId: String(sheetId),
      anchorRow: sheet.selectedCell?.row ?? 0,
      anchorCol: sheet.selectedCell?.col ?? 0,
      w: 480,
      h: 320 + 32,
    })
    toast.success(`Inserted photo by ${photo.photographer}`)
  }

  const visiblePhotos =
    category === 'All' ? STOCK_PHOTOS : STOCK_PHOTOS.filter((p) => p.category === category)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Stock Images</DialogTitle>
          <DialogDescription>
            Free-to-use photos from Unsplash. Click any image to drop it
            into your sheet as a floating overlay.
          </DialogDescription>
        </DialogHeader>

        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          {(['All', ...STOCK_PHOTO_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={
                'rounded-full px-3 py-0.5 text-[11px] font-medium ' +
                (category === c
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800')
              }
            >
              {c}
            </button>
          ))}
        </div>

        {/* Photo grid */}
        <div className="grid max-h-[460px] grid-cols-5 gap-1.5 overflow-y-auto pr-1 pt-2">
          {visiblePhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => insert(photo)}
              title={`${photo.alt} — by ${photo.photographer}`}
              className="group relative overflow-hidden rounded border border-zinc-200 hover:border-blue-400 dark:border-zinc-700 dark:hover:border-blue-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnail}
                alt={photo.alt}
                loading="lazy"
                draggable={false}
                className="aspect-[3/2] w-full select-none object-cover transition-transform group-hover:scale-105"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-left text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {photo.photographer}
              </span>
            </button>
          ))}
        </div>

        <p className="border-t border-zinc-200 pt-2 text-[10px] text-zinc-500 dark:border-zinc-800">
          Photos by{' '}
          <a
            href="https://unsplash.com/license"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600"
          >
            Unsplash contributors
          </a>{' '}
          — free for commercial and personal use.
        </p>
      </DialogContent>
    </Dialog>
  )
}
