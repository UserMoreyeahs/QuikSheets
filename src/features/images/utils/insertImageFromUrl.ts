'use client'

/**
 * insertImageFromUrl — Insert > Pictures > Online Pictures.
 *
 * Prompts the user for a public image URL and inserts it as a floating
 * overlay anchored to the active cell. We DO NOT fetch the bytes —
 * the renderer just sets <img src={url}> so any browser-loadable URL
 * works. This sidesteps CORS for image display (the browser fetches
 * the image directly), but it means the URL must outlive the workbook
 * — if the host disappears, the image breaks. That's a fair trade for
 * the simplicity of "paste any URL".
 *
 * If the user instead has a data URL (paste from a screenshot tool, etc.)
 * the same flow accepts it — the renderer handles both transparently.
 */

import { toast } from 'sonner'
import { useImageStore } from '../store/imageStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'

const VALID_PROTOCOLS = new Set(['http:', 'https:', 'data:'])

/** Loose ext sniff — used only for the auto-generated panel title. */
function inferName(url: string): string {
  if (url.startsWith('data:')) return 'Pasted image'
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    return last || u.hostname || 'Online image'
  } catch {
    return 'Online image'
  }
}

function probeNaturalSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 480, h: 320 })
    img.src = src
  })
}

/**
 * Insert an image from a public URL. If `url` is omitted, prompts the
 * user. Returns a promise that resolves once the image has loaded (or
 * the load timed out) so callers can chain follow-up actions.
 */
export async function insertImageFromUrl(url?: string): Promise<void> {
  let raw = url
  if (!raw) {
    const { promptDialog } = await import('@/components/PromptDialog')
    raw = (await promptDialog({
      title: 'Image URL',
      message: 'Use an HTTPS URL pointing at a public image (PNG / JPG / GIF / SVG), or paste a data: URL.',
      defaultValue: 'https://',
      inputType: 'url',
    })) ?? undefined
  }
  if (!raw) return
  const trimmed = raw.trim()
  if (!trimmed) return

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    toast.error('That doesn’t look like a valid URL.')
    return
  }
  if (!VALID_PROTOCOLS.has(parsed.protocol)) {
    toast.error(`Unsupported protocol "${parsed.protocol}". Use https: or data:.`)
    return
  }

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

  // Probe size so the panel matches the image aspect ratio. If the load
  // fails (404, blocked CORS for size detection, etc.) we still insert
  // at a sensible default and let the user see the broken-image icon.
  const { w, h } = await probeNaturalSize(trimmed)
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
  renderH += 32 // title bar

  useImageStore.getState().addImage({
    src: trimmed,
    name: inferName(trimmed),
    sheetId: String(sheetId),
    anchorRow: sheet.selectedCell?.row ?? 0,
    anchorCol: sheet.selectedCell?.col ?? 0,
    w: renderW,
    h: renderH,
  })

  toast.success('Image inserted')
}
