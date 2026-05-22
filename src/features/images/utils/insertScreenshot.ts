'use client'

/**
 * insertScreenshot — Insert > Screenshot ribbon handler.
 *
 * Uses the browser's getDisplayMedia API to prompt the user to share a
 * window, tab, or full screen. We then read a single frame from the
 * video stream, paint it onto an off-screen canvas, snapshot it as a
 * PNG data URL, and drop it into the image store so ImagesLayer
 * renders it as a floating, draggable, resizable overlay.
 *
 * The MediaStream is closed immediately after capture so the user's
 * browser-level "screen sharing" indicator clears.
 *
 * Excel-equivalent: Insert > Screenshot.
 *
 * Caveat — getDisplayMedia requires a user gesture (button click) AND a
 * secure context (https or localhost). If we're embedded in an insecure
 * iframe, the call rejects. We surface the rejection as a toast.
 */

import { toast } from 'sonner'
import { useImageStore } from '../store/imageStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'

/** Drop large captures down to this width to keep the in-memory data URL
 *  reasonable. 1600px wide is plenty for an in-sheet reference image. */
const MAX_CAPTURE_WIDTH = 1600

/** Default panel size when inserting — the chrome adds another ~32px for
 *  the title bar, matching the existing image overlay layout. */
const DEFAULT_PANEL_WIDTH = 480
const DEFAULT_PANEL_HEIGHT = 320

export async function insertScreenshot(): Promise<void> {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (!md || typeof md.getDisplayMedia !== 'function') {
    toast.error('Screenshot is not supported in this browser. Try Chrome / Edge / Firefox on a secure (https) page.')
    return
  }

  let stream: MediaStream | null = null
  try {
    // `cursor: 'always'` keeps the OS cursor visible in the captured image,
    // which is what users usually want when capturing a tutorial.
    stream = await md.getDisplayMedia({
      video: { cursor: 'always' } as MediaTrackConstraints,
      audio: false,
    })
  } catch (err) {
    // User dismissed the picker or denied permission — quiet exit.
    const msg = err instanceof Error ? err.message : 'unknown error'
    if (/permission denied|not allowed|aborted/i.test(msg)) {
      // Don't toast on cancel — feels like a yelling error for a normal action.
      return
    }
    toast.error(`Could not start screen capture: ${msg}`)
    return
  }

  try {
    const dataUrl = await captureFirstFrame(stream)
    if (!dataUrl) {
      toast.error('Could not capture a frame from the screen.')
      return
    }

    // Probe the captured size so we can pick a panel aspect that matches.
    const { w: imgW, h: imgH } = await probeSize(dataUrl)
    let renderW = imgW
    let renderH = imgH
    if (renderW > DEFAULT_PANEL_WIDTH) {
      const scale = DEFAULT_PANEL_WIDTH / renderW
      renderW = DEFAULT_PANEL_WIDTH
      renderH = Math.round(renderH * scale)
    }
    if (renderH > DEFAULT_PANEL_HEIGHT) {
      const scale = DEFAULT_PANEL_HEIGHT / renderH
      renderH = DEFAULT_PANEL_HEIGHT
      renderW = Math.round(renderW * scale)
    }
    renderH += 32 // title bar

    const sheet = useSheetStore.getState()
    const { activeSheetId } = useWorkbookStore.getState()
    const sheetId =
      activeSheetId ??
      sheet.gridSheets.find((s) => s.status === 1)?.id ??
      sheet.gridSheets[0]?.id

    if (!sheetId) {
      toast.error('No active sheet — cannot insert screenshot')
      return
    }

    useImageStore.getState().addImage({
      src: dataUrl,
      name: `Screenshot ${new Date().toLocaleTimeString()}`,
      sheetId: String(sheetId),
      anchorRow: sheet.selectedCell?.row ?? 0,
      anchorCol: sheet.selectedCell?.col ?? 0,
      w: renderW,
      h: renderH,
    })

    toast.success('Screenshot captured — drag to reposition')
  } finally {
    // Always stop the stream so the browser's "sharing screen" indicator
    // disappears. Doing this in `finally` is important: if the capture
    // step throws, the indicator would otherwise linger.
    stream?.getTracks().forEach((t) => t.stop())
  }
}

/**
 * Draws a single frame from the stream onto an offscreen canvas and
 * returns it as a PNG data URL. Returns null if the stream produces no
 * video frame (e.g. tab capture of a blank page).
 */
async function captureFirstFrame(stream: MediaStream): Promise<string | null> {
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true

  // Wait for the first frame so videoWidth/videoHeight are reliable.
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const onReady = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const onError = () => {
      if (settled) return
      settled = true
      reject(new Error('video error'))
    }
    video.onloadedmetadata = onReady
    video.onerror = onError
    // Fallback: some browsers don't fire loadedmetadata for display
    // streams reliably, so race with a 'playing' event.
    video.onplaying = onReady
    video.play().catch(onError)
  })

  let w = video.videoWidth
  let h = video.videoHeight
  if (!w || !h) return null

  // Optionally scale down very large captures so the data URL doesn't
  // balloon. 4K screens → ~3840×2160 → too big for an in-memory PNG.
  if (w > MAX_CAPTURE_WIDTH) {
    const scale = MAX_CAPTURE_WIDTH / w
    w = MAX_CAPTURE_WIDTH
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

function probeSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 640, h: 480 })
    img.src = src
  })
}
