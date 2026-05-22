'use client'

/**
 * overlayStore — unified store for in-grid floating overlays.
 *
 * Mirrors the image store pattern but supports three overlay kinds in a
 * single discriminated-union list:
 *
 *   - 'shape'   → SVG primitive (rectangle / ellipse / line / arrow / …)
 *   - 'icon'    → curated lucide icon picked from IconPicker
 *   - 'textbox' → free-form text with font/colour controls
 *
 * Overlays are in-memory only (lost on reload), matching ImagesLayer /
 * ChartsLayer / SparklinesLayer behaviour. The cell-anchor + offset
 * system is identical so the existing useGridScroll hook keeps them
 * glued to the cell as the user scrolls.
 */

import { create } from 'zustand'

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'diamond'

export interface BaseOverlay {
  id: string
  sheetId: string
  /** Cell anchor — overlay scrolls with this cell. */
  anchorRow: number
  anchorCol: number
  /** Offset from the anchor cell's top-left, in pixels. */
  x: number
  y: number
  /** Rendered dimensions, in pixels. */
  w: number
  h: number
}

export interface ShapeOverlay extends BaseOverlay {
  kind: 'shape'
  shape: ShapeKind
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

export interface IconOverlay extends BaseOverlay {
  kind: 'icon'
  /** Lucide icon name (from CURATED_ICON_NAMES). */
  iconName: string
  color: string
}

export interface TextboxOverlay extends BaseOverlay {
  kind: 'textbox'
  text: string
  fontSize: number
  textColor: string
  backgroundColor: string
  bold: boolean
  italic: boolean
}

export type InsertedOverlay = ShapeOverlay | IconOverlay | TextboxOverlay

interface OverlayStoreState {
  overlays: InsertedOverlay[]
  /** Insert a shape overlay near the selected cell. */
  addShape: (input: Omit<ShapeOverlay, 'id' | 'x' | 'y' | 'w' | 'h'> & Partial<Pick<ShapeOverlay, 'w' | 'h'>>) => void
  /** Insert an icon overlay near the selected cell. */
  addIcon: (input: Omit<IconOverlay, 'id' | 'x' | 'y' | 'w' | 'h'> & Partial<Pick<IconOverlay, 'w' | 'h'>>) => void
  /** Insert a text-box overlay near the selected cell. */
  addTextbox: (input: Omit<TextboxOverlay, 'id' | 'x' | 'y' | 'w' | 'h'> & Partial<Pick<TextboxOverlay, 'w' | 'h'>>) => void
  removeOverlay: (id: string) => void
  moveOverlay:   (id: string, x: number, y: number) => void
  resizeOverlay: (id: string, w: number, h: number) => void
  /** Mutate type-specific fields (text content, color, etc). */
  updateOverlay: (id: string, patch: Partial<InsertedOverlay>) => void
}

let nextOffset = 0
function bumpOffset(): number {
  nextOffset = (nextOffset + 30) % 200
  return nextOffset
}

export const useOverlayStore = create<OverlayStoreState>((set) => ({
  overlays: [],
  addShape: (input) =>
    set((state) => {
      const offset = bumpOffset()
      const shape: ShapeOverlay = {
        ...input,
        id: crypto.randomUUID(),
        x: 80 + offset,
        y: 140 + offset,
        w: input.w ?? 160,
        h: input.h ?? 120,
      }
      return { overlays: [...state.overlays, shape] }
    }),
  addIcon: (input) =>
    set((state) => {
      const offset = bumpOffset()
      const icon: IconOverlay = {
        ...input,
        id: crypto.randomUUID(),
        x: 80 + offset,
        y: 140 + offset,
        w: input.w ?? 80,
        h: input.h ?? 80,
      }
      return { overlays: [...state.overlays, icon] }
    }),
  addTextbox: (input) =>
    set((state) => {
      const offset = bumpOffset()
      const box: TextboxOverlay = {
        ...input,
        id: crypto.randomUUID(),
        x: 80 + offset,
        y: 140 + offset,
        w: input.w ?? 220,
        h: input.h ?? 80,
      }
      return { overlays: [...state.overlays, box] }
    }),
  removeOverlay: (id) =>
    set((state) => ({ overlays: state.overlays.filter((o) => o.id !== id) })),
  moveOverlay: (id, x, y) =>
    set((state) => ({
      overlays: state.overlays.map((o) => (o.id === id ? { ...o, x, y } : o)),
    })),
  resizeOverlay: (id, w, h) =>
    set((state) => ({
      overlays: state.overlays.map((o) => (o.id === id ? { ...o, w, h } : o)),
    })),
  updateOverlay: (id, patch) =>
    set((state) => ({
      overlays: state.overlays.map((o) => {
        if (o.id !== id) return o
        // Type assertion — caller is responsible for sending matching kind fields.
        return { ...o, ...patch } as InsertedOverlay
      }),
    })),
}))

// ─── Pickers ────────────────────────────────────────────────────────────
// Picker dialog state lives in its own tiny stores so opening the picker
// doesn't re-render anything else.

interface PickerState {
  open: boolean
  openPicker:  () => void
  closePicker: () => void
}

export const useShapePickerStore = create<PickerState>((set) => ({
  open: false,
  openPicker:  () => set({ open: true }),
  closePicker: () => set({ open: false }),
}))

export const useIconPickerStore = create<PickerState>((set) => ({
  open: false,
  openPicker:  () => set({ open: true }),
  closePicker: () => set({ open: false }),
}))
