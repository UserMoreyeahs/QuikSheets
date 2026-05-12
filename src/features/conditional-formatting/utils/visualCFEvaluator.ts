import type { Sheet } from '@fortune-sheet/core'
import type { CFDataBarConfig, CFColorScaleConfig, CFIconSetConfig } from '../types'
import { parseRange } from './cfEvaluator'

/** Parse a hex color string like '#FF0000' into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Convert [r, g, b] to '#RRGGBB'. */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

/** Linearly interpolate between two hex colors. t=0→c1, t=1→c2. */
export function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1)
  const [r2, g2, b2] = hexToRgb(c2)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Extract numeric values from a range of cells in a sheet. Returns Map<"row:col", number>. */
function extractNumericValues(sheet: Sheet, rangeStr: string): Map<string, number> {
  const range = parseRange(rangeStr, sheet.row ?? 100, sheet.column ?? 26)
  const result = new Map<string, number>()
  const celldata = sheet.celldata ?? []
  const dataMatrix = sheet.data

  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      let raw: unknown = undefined
      // Try data matrix first
      if (dataMatrix && dataMatrix[r]) {
        const cell = dataMatrix[r]![c]
        if (cell) raw = cell.v
      } else {
        // Fall back to celldata
        const cell = celldata.find((cd: { r: number; c: number }) => cd.r === r && cd.c === c)
        if (cell) {
          const v = (cell as { v?: { v?: unknown } }).v
          raw = v?.v
        }
      }
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
      if (!isNaN(num)) {
        result.set(`${r}:${c}`, num)
      }
    }
  }
  return result
}

// ─── Data Bar evaluation ───────────────────────────────────────────

/**
 * For each numeric cell in the range, compute a background color that
 * represents a "data bar" using the cell's proportion within the range.
 * Since FortuneSheet renders on canvas, we approximate bars by varying
 * the lightness of the bar color.
 */
export function evaluateDataBar(
  sheet: Sheet,
  rangeStr: string,
  config: CFDataBarConfig
): Map<string, { bg: string }> {
  const values = extractNumericValues(sheet, rangeStr)
  const result = new Map<string, { bg: string }>()
  if (values.size === 0) return result

  const nums = Array.from(values.values())
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1

  const [cr, cg, cb] = hexToRgb(config.color)

  for (const [key, num] of values) {
    const proportion = (num - min) / span // 0 (min) to 1 (max)
    // High proportion → more saturated color; low → lighter/whiter
    if (config.gradient) {
      // Gradient: blend from white to bar color based on proportion
      const t = 0.15 + proportion * 0.85 // 0.15 to 1.0 (never fully white)
      const bg = rgbToHex(255 - (255 - cr) * t, 255 - (255 - cg) * t, 255 - (255 - cb) * t)
      result.set(key, { bg })
    } else {
      // Solid: uniform color with varying alpha approximated by lightness
      const lightness = 1 - proportion * 0.65 // 1.0 down to 0.35
      const bg = rgbToHex(cr + (255 - cr) * lightness, cg + (255 - cg) * lightness, cb + (255 - cb) * lightness)
      result.set(key, { bg })
    }
  }
  return result
}

// ─── Color Scale evaluation ────────────────────────────────────────

export function evaluateColorScale(
  sheet: Sheet,
  rangeStr: string,
  config: CFColorScaleConfig
): Map<string, { bg: string }> {
  const values = extractNumericValues(sheet, rangeStr)
  const result = new Map<string, { bg: string }>()
  if (values.size === 0) return result

  const nums = Array.from(values.values())
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1

  for (const [key, num] of values) {
    const t = (num - min) / span

    let bg: string
    if (config.midColor !== undefined) {
      // 3-color scale: min→mid for lower half, mid→max for upper half
      if (t <= 0.5) {
        bg = lerpColor(config.minColor, config.midColor, t * 2)
      } else {
        bg = lerpColor(config.midColor, config.maxColor, (t - 0.5) * 2)
      }
    } else {
      // 2-color scale
      bg = lerpColor(config.minColor, config.maxColor, t)
    }
    result.set(key, { bg })
  }
  return result
}

// ─── Icon Set evaluation ───────────────────────────────────────────

/**
 * For each numeric cell, determine which icon to prepend based on the
 * cell's position in the value distribution. Divides range into equal
 * buckets matching the icon count.
 */
export function evaluateIconSet(
  sheet: Sheet,
  rangeStr: string,
  config: CFIconSetConfig
): Map<string, { icon: string }> {
  const values = extractNumericValues(sheet, rangeStr)
  const result = new Map<string, { icon: string }>()
  if (values.size === 0 || config.icons.length === 0) return result

  const nums = Array.from(values.values())
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const buckets = config.icons.length

  for (const [key, num] of values) {
    const t = (num - min) / span // 0 to 1
    // Icon index: 0 = best (highest), last = worst (lowest)
    // Icons are ordered best-to-worst, so higher t → index 0
    const idx = Math.min(buckets - 1, Math.floor((1 - t) * buckets))
    result.set(key, { icon: config.icons[idx] ?? '' })
  }
  return result
}
