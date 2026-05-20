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
//
// Mirrors the Cell Styles gallery in MS Excel — 5 categories × ~6
// presets each. Each entry carries a `category` so the dropdown can
// render section headers between blocks.
//
// Color palette comes from Excel's default Office theme:
//   Accent 1 = #4472C4 (Blue)
//   Accent 2 = #ED7D31 (Orange)
//   Accent 3 = #A5A5A5 (Gray)
//   Accent 4 = #FFC000 (Gold)
//   Accent 5 = #5B9BD5 (Light Blue)
//   Accent 6 = #70AD47 (Green)

export const CELL_STYLE_PRESETS: CFCellStylePreset[] = [
  // ── Good, Bad and Neutral ────────────────────────────────────
  { label: 'Normal',  category: 'Good, Bad and Neutral' },
  { label: 'Good',    category: 'Good, Bad and Neutral', fill: '#C6EFCE', color: '#006100' },
  { label: 'Bad',     category: 'Good, Bad and Neutral', fill: '#FFC7CE', color: '#9C0006' },
  { label: 'Neutral', category: 'Good, Bad and Neutral', fill: '#FFEB9C', color: '#9C6500' },

  // ── Data and Model ───────────────────────────────────────────
  { label: 'Calculation',       category: 'Data and Model', fill: '#F2F2F2', color: '#FA7D00', bold: true },
  { label: 'Check Cell',        category: 'Data and Model', fill: '#A5A5A5', color: '#FFFFFF', bold: true },
  { label: 'Explanatory Text',  category: 'Data and Model', color: '#7F7F7F', italic: true },
  { label: 'Input',             category: 'Data and Model', fill: '#FFCC99', color: '#3F3F76' },
  { label: 'Linked Cell',       category: 'Data and Model', color: '#FA7D00', borderBottom: '2px solid #FA7D00' },
  { label: 'Note',              category: 'Data and Model', fill: '#FFFFCC', color: '#9C5700' },
  { label: 'Output',            category: 'Data and Model', fill: '#F2F2F2', color: '#3F3F3F', bold: true },
  { label: 'Warning Text',      category: 'Data and Model', color: '#FF0000' },

  // ── Titles and Headings ──────────────────────────────────────
  { label: 'Title',     category: 'Titles and Headings', color: '#1F4E79', bold: true, fontSize: 18 },
  { label: 'Heading 1', category: 'Titles and Headings', color: '#1F4E79', bold: true, fontSize: 15, borderBottom: '2px solid #4472C4' },
  { label: 'Heading 2', category: 'Titles and Headings', color: '#1F4E79', bold: true, fontSize: 13, borderBottom: '1px solid #4472C4' },
  { label: 'Heading 3', category: 'Titles and Headings', color: '#1F4E79', bold: true, fontSize: 12 },
  { label: 'Heading 4', category: 'Titles and Headings', color: '#1F4E79', italic: true, fontSize: 11 },
  { label: 'Total',     category: 'Titles and Headings', bold: true, fill: '#D9E2F3', color: '#1F4E79' },

  // ── Themed Cell Styles (one row per accent, Light/Medium/Dark tint) ─
  // Accent 1 — Blue
  { label: '20% – Accent1', category: 'Themed Cell Styles', fill: '#D9E2F3' },
  { label: '40% – Accent1', category: 'Themed Cell Styles', fill: '#B4C7E7' },
  { label: '60% – Accent1', category: 'Themed Cell Styles', fill: '#8FAADC', color: '#FFFFFF' },
  { label: 'Accent1',       category: 'Themed Cell Styles', fill: '#4472C4', color: '#FFFFFF' },
  // Accent 2 — Orange
  { label: '20% – Accent2', category: 'Themed Cell Styles', fill: '#FBE5D6' },
  { label: '40% – Accent2', category: 'Themed Cell Styles', fill: '#F8CBAD' },
  { label: '60% – Accent2', category: 'Themed Cell Styles', fill: '#F4B084', color: '#FFFFFF' },
  { label: 'Accent2',       category: 'Themed Cell Styles', fill: '#ED7D31', color: '#FFFFFF' },
  // Accent 3 — Gray
  { label: '20% – Accent3', category: 'Themed Cell Styles', fill: '#EDEDED' },
  { label: 'Accent3',       category: 'Themed Cell Styles', fill: '#A5A5A5', color: '#FFFFFF' },
  // Accent 6 — Green (most-used for "money/positive" categories)
  { label: '20% – Accent6', category: 'Themed Cell Styles', fill: '#E2EFDA' },
  { label: 'Accent6',       category: 'Themed Cell Styles', fill: '#70AD47', color: '#FFFFFF' },

  // ── Number Format ────────────────────────────────────────────
  // These set a numberFormat string in addition to (or instead of) colour.
  { label: 'Comma',       category: 'Number Format', numberFormat: '#,##0.00' },
  { label: 'Comma [0]',   category: 'Number Format', numberFormat: '#,##0' },
  { label: 'Currency',    category: 'Number Format', numberFormat: '$#,##0.00' },
  { label: 'Currency [0]',category: 'Number Format', numberFormat: '$#,##0' },
  { label: 'Percent',     category: 'Number Format', numberFormat: '0%' },
]
