'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type Orientation = 'portrait' | 'landscape'
export type MarginPreset = 'normal' | 'wide' | 'narrow' | 'custom'
export type PaperSize = 'a4' | 'letter' | 'legal' | 'a3' | 'a5'

export interface MarginInches {
  top: number
  right: number
  bottom: number
  left: number
}

/** Excel's standard margin presets (inches). */
export const MARGIN_PRESETS: Record<Exclude<MarginPreset, 'custom'>, MarginInches> = {
  normal: { top: 0.75, right: 0.7, bottom: 0.75, left: 0.7 },
  wide:   { top: 1.0,  right: 1.0, bottom: 1.0,  left: 1.0 },
  narrow: { top: 0.75, right: 0.25, bottom: 0.75, left: 0.25 },
}

export interface PrintArea {
  /** Range like "A1:F25" — applied at PDF export to limit what's emitted. */
  range: string
}

interface PrintSettingsState {
  orientation: Orientation
  marginPreset: MarginPreset
  margins: MarginInches
  paperSize: PaperSize
  printArea: PrintArea | null
  scalePct: number // 100 = no scaling
}

interface PrintSettingsActions {
  setOrientation: (o: Orientation) => void
  setMarginPreset: (preset: MarginPreset) => void
  setCustomMargins: (m: MarginInches) => void
  setPaperSize: (s: PaperSize) => void
  setPrintArea: (range: string | null) => void
  setScalePct: (pct: number) => void
  reset: () => void
}

const initialState: PrintSettingsState = {
  orientation: 'portrait',
  marginPreset: 'normal',
  margins: MARGIN_PRESETS.normal,
  paperSize: 'letter',
  printArea: null,
  scalePct: 100,
}

export const usePrintSettingsStore = create<PrintSettingsState & PrintSettingsActions>()(
  devtools(
    (set) => ({
      ...initialState,

      setOrientation: (orientation) => set({ orientation }, false, 'print/setOrientation'),

      setMarginPreset: (preset) =>
        set(
          {
            marginPreset: preset,
            margins: preset === 'custom' ? initialState.margins : MARGIN_PRESETS[preset],
          },
          false,
          'print/setMarginPreset',
        ),

      setCustomMargins: (margins) =>
        set({ marginPreset: 'custom', margins }, false, 'print/setCustomMargins'),

      setPaperSize: (paperSize) => set({ paperSize }, false, 'print/setPaperSize'),

      setPrintArea: (range) =>
        set({ printArea: range ? { range } : null }, false, 'print/setPrintArea'),

      setScalePct: (scalePct) => set({ scalePct }, false, 'print/setScalePct'),

      reset: () => set(initialState, false, 'print/reset'),
    }),
    { name: 'PrintSettingsStore' },
  ),
)
