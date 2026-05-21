'use client'

import { create } from 'zustand'

export interface InsertedImage {
  id: string
  /** Data-URL (base64) — we keep images in-memory only; lost on reload. */
  src: string
  /** Original filename — used as the panel title. */
  name: string
  /** Sheet this image was inserted on. */
  sheetId: string
  /** Cell anchor — image scrolls with this cell. */
  anchorRow: number
  anchorCol: number
  /** Offset from the anchor cell's top-left, in pixels. */
  x: number
  y: number
  /** Rendered dimensions, in pixels. */
  w: number
  h: number
}

interface ImageStoreState {
  images: InsertedImage[]
  addImage:    (img: Omit<InsertedImage, 'id' | 'x' | 'y' | 'w' | 'h'> & Partial<Pick<InsertedImage, 'w' | 'h'>>) => void
  removeImage: (id: string) => void
  moveImage:   (id: string, x: number, y: number) => void
  resizeImage: (id: string, w: number, h: number) => void
}

let nextOffset = 0

export const useImageStore = create<ImageStoreState>((set) => ({
  images: [],
  addImage: (img) =>
    set((state) => {
      nextOffset = (nextOffset + 30) % 200
      const newImage: InsertedImage = {
        ...img,
        id: crypto.randomUUID(),
        x: 80 + nextOffset,
        y: 140 + nextOffset,
        w: img.w ?? 320,
        h: img.h ?? 240,
      }
      return { images: [...state.images, newImage] }
    }),
  removeImage: (id) =>
    set((state) => ({ images: state.images.filter((i) => i.id !== id) })),
  moveImage: (id, x, y) =>
    set((state) => ({
      images: state.images.map((i) => (i.id === id ? { ...i, x, y } : i)),
    })),
  resizeImage: (id, w, h) =>
    set((state) => ({
      images: state.images.map((i) => (i.id === id ? { ...i, w, h } : i)),
    })),
}))
