import type { CFFormatPreset, CFCellStylePreset } from '../types'

// ─── Format presets (shown in Excel's quick CF dialogs) ────────────
export const FORMAT_PRESETS: CFFormatPreset[] = [
  { label: 'Light Red Fill with Dark Red Text', fill: '#FFC7CE', color: '#9C0006' },
  { label: 'Yellow Fill with Dark Yellow Text', fill: '#FFEB9C', color: '#9C6500' },
  { label: 'Green Fill with Dark Green Text', fill: '#C6EFCE', color: '#006100' },
  { label: 'Light Red Fill', fill: '#FFC7CE', color: '#000000' },
  { label: 'Red Text', fill: '#FFFFFF', color: '#FF0000' },
]

// ─── Data Bar presets ──────────────────────────────────────────────
export interface DataBarPreset {
  label: string
  color: string
  gradient: boolean
}

const DB_COLORS = [
  { name: 'Blue', color: '#638EC6' },
  { name: 'Green', color: '#63C384' },
  { name: 'Red', color: '#FF555A' },
  { name: 'Orange', color: '#FFB628' },
  { name: 'Light Blue', color: '#008AEF' },
  { name: 'Purple', color: '#D6007B' },
]

export const DATA_BAR_PRESETS: DataBarPreset[] = [
  ...DB_COLORS.map((c) => ({ label: `${c.name} Gradient`, color: c.color, gradient: true })),
  ...DB_COLORS.map((c) => ({ label: `${c.name} Solid`, color: c.color, gradient: false })),
]

// ─── Color Scale presets ───────────────────────────────────────────
export interface ColorScalePreset {
  label: string
  minColor: string
  midColor?: string
  maxColor: string
}

export const COLOR_SCALE_PRESETS: ColorScalePreset[] = [
  { label: 'Green – Yellow – Red', minColor: '#63BE7B', midColor: '#FFEB84', maxColor: '#F8696B' },
  { label: 'Red – Yellow – Green', minColor: '#F8696B', midColor: '#FFEB84', maxColor: '#63BE7B' },
  { label: 'Green – White – Red', minColor: '#63BE7B', midColor: '#FFFFFF', maxColor: '#F8696B' },
  { label: 'Red – White – Green', minColor: '#F8696B', midColor: '#FFFFFF', maxColor: '#63BE7B' },
  { label: 'Blue – White – Red', minColor: '#5A8AC6', midColor: '#FFFFFF', maxColor: '#F8696B' },
  { label: 'Red – White – Blue', minColor: '#F8696B', midColor: '#FFFFFF', maxColor: '#5A8AC6' },
  { label: 'White – Red', minColor: '#FFFFFF', maxColor: '#F8696B' },
  { label: 'Red – White', minColor: '#F8696B', maxColor: '#FFFFFF' },
  { label: 'Green – White', minColor: '#63BE7B', maxColor: '#FFFFFF' },
  { label: 'White – Green', minColor: '#FFFFFF', maxColor: '#63BE7B' },
  { label: 'Green – Yellow', minColor: '#63BE7B', maxColor: '#FFEB84' },
  { label: 'Yellow – Green', minColor: '#FFEB84', maxColor: '#63BE7B' },
]

// ─── Icon Set presets ──────────────────────────────────────────────
export interface IconSetPreset {
  name: string
  label: string
  category: 'Directional' | 'Shapes' | 'Indicators' | 'Ratings'
  icons: string[]
}

export const ICON_SET_PRESETS: IconSetPreset[] = [
  { name: '3arrows', label: '3 Arrows', category: 'Directional', icons: ['▲', '▶', '▼'] },
  { name: '4arrows', label: '4 Arrows', category: 'Directional', icons: ['▲', '↗', '↘', '▼'] },
  { name: '5arrows', label: '5 Arrows', category: 'Directional', icons: ['▲', '↗', '▶', '↘', '▼'] },
  { name: '3trafficlights', label: '3 Traffic Lights', category: 'Shapes', icons: ['🟢', '🟡', '🔴'] },
  { name: '3signs', label: '3 Signs', category: 'Shapes', icons: ['✅', '⚠️', '⛔'] },
  { name: '3symbols', label: '3 Symbols', category: 'Indicators', icons: ['✔', '⚠', '✖'] },
  { name: '3flags', label: '3 Flags', category: 'Indicators', icons: ['🟩', '🟨', '🟥'] },
  { name: '3stars', label: '3 Stars', category: 'Ratings', icons: ['★★★', '★★', '★'] },
  { name: '4ratings', label: '4 Ratings', category: 'Ratings', icons: ['●●●●', '●●●', '●●', '●'] },
  { name: '5quarters', label: '5 Quarters', category: 'Ratings', icons: ['●', '◕', '◑', '◔', '○'] },
]

// ─── Cell Style presets ────────────────────────────────────────────
export const CELL_STYLE_PRESETS: CFCellStylePreset[] = [
  { label: 'Normal' },
  { label: 'Good', fill: '#C6EFCE', color: '#006100' },
  { label: 'Bad', fill: '#FFC7CE', color: '#9C0006' },
  { label: 'Neutral', fill: '#FFEB9C', color: '#9C6500' },
  { label: 'Heading 1', color: '#1F4E79', bold: true, fontSize: 14 },
  { label: 'Heading 2', color: '#2E75B6', bold: true, fontSize: 12 },
  { label: 'Title', color: '#1F4E79', bold: true, fontSize: 16 },
  { label: 'Total', bold: true, fill: '#D9E2F3', color: '#1F4E79' },
]
