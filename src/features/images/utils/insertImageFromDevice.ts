'use client'

import { useImageStore } from '../store/imageStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toast } from 'sonner'

/** Max accepted file size (bytes). Above this we refuse the upload —
 *  data URLs balloon by ~33% and large images blow up the in-memory store. */
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('FileReader did not return a string'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function probeNaturalSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 320, h: 240 })
    img.src = src
  })
}

/**
 * Opens a hidden file input, lets the user pick a single image, reads it
 * as a data URL, anchors it to the selected cell (or A1 if nothing is
 * selected), and adds it to the image store so ImagesLayer can render it.
 *
 * Intentionally synchronous-feeling: we DON'T await server upload; this
 * is in-memory only. If the user reloads the page they lose the picture.
 */
export function insertImageFromDevice(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ACCEPT_TYPES.join(',')
  input.style.display = 'none'

  input.onchange = async () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return

    if (!ACCEPT_TYPES.includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type || 'unknown'}`)
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under 5 MB`)
      return
    }

    try {
      const dataUrl = await readAsDataURL(file)
      const { w, h } = await probeNaturalSize(dataUrl)
      // Fit into a sensible default box (max 480x360) while preserving ratio.
      let renderW = w
      let renderH = h
      const maxW = 480
      const maxH = 360
      if (renderW > maxW) {
        const scale = maxW / renderW
        renderW = maxW
        renderH = Math.round(renderH * scale)
      }
      if (renderH > maxH) {
        const scale = maxH / renderH
        renderH = maxH
        renderW = Math.round(renderW * scale)
      }
      renderH += 32 // panel header

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

      const anchorRow = sheet.selectedCell?.row ?? 0
      const anchorCol = sheet.selectedCell?.col ?? 0

      useImageStore.getState().addImage({
        src: dataUrl,
        name: file.name,
        sheetId: String(sheetId),
        anchorRow,
        anchorCol,
        w: renderW,
        h: renderH,
      })

      toast.success(`Inserted ${file.name}`)
    } catch (err) {
      toast.error(`Failed to read image: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  document.body.appendChild(input)
  input.click()
}
