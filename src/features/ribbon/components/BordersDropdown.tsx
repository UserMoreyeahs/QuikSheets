'use client'

/**
 * BordersDropdown — Excel-faithful borders picker.
 *
 * Replaces the previous text-only DropdownMenu with a visual grid:
 *
 *   ┌─────────────────────────────┐
 *   │ ▢ Bottom  ▢ Top   ▢ Left ▢R│   ← preset grid with mini-icons
 *   │ ▢ No      ▢ All   ▢ Out  ▢T│
 *   ├─────────────────────────────┤
 *   │ Line Color   [picker]       │
 *   │ Line Style   ─ ┄ ╌ ━        │   ← 4 styles
 *   ├─────────────────────────────┤
 *   │ More Borders… (Format Cells)│
 *   └─────────────────────────────┘
 *
 * Each preset button shows a 3x3-cell mini SVG with the relevant
 * edges highlighted so the user picks visually rather than by reading
 * "Top Border" text labels.
 *
 * Selected line color + line style apply to subsequent preset clicks
 * until the menu closes. The "More Borders…" link still routes to
 * the existing dialog stub (no behavioural regression).
 */

import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { applyBorder, type BorderPreset, type BorderLineStyle } from '../utils/cellOps'
import { ribbonStub } from '../utils/ribbonStub'

interface PresetButtonProps {
  label: string
  preset: BorderPreset
  /** Hex color used to draw the active edges in the icon. */
  iconColor: string
  /** Which edges to highlight in the icon. */
  edges: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean; all?: boolean; outline?: boolean }
  thick?: boolean
  onPick: (preset: BorderPreset) => void
}

/** 16x16 SVG icon showing a 3×3 cell-grid with the relevant edges accented. */
function BorderIcon({ edges, color, thick }: { edges: PresetButtonProps['edges']; color: string; thick?: boolean }) {
  const sw = thick ? 2 : 1.25
  const accent = color
  const dim = '#D4D4D8' // zinc-300
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="shrink-0" aria-hidden>
      {/* Light grid for context */}
      <line x1="1" y1="6"  x2="15" y2="6"  stroke={dim} strokeWidth="0.5" />
      <line x1="1" y1="10" x2="15" y2="10" stroke={dim} strokeWidth="0.5" />
      <line x1="6"  y1="1" x2="6"  y2="15" stroke={dim} strokeWidth="0.5" />
      <line x1="10" y1="1" x2="10" y2="15" stroke={dim} strokeWidth="0.5" />

      {/* Accented edges */}
      {(edges.all || edges.top || edges.outline) && (
        <line x1="1" y1="1" x2="15" y2="1" stroke={accent} strokeWidth={sw} />
      )}
      {(edges.all || edges.bottom || edges.outline) && (
        <line x1="1" y1="15" x2="15" y2="15" stroke={accent} strokeWidth={sw} />
      )}
      {(edges.all || edges.left || edges.outline) && (
        <line x1="1" y1="1" x2="1" y2="15" stroke={accent} strokeWidth={sw} />
      )}
      {(edges.all || edges.right || edges.outline) && (
        <line x1="15" y1="1" x2="15" y2="15" stroke={accent} strokeWidth={sw} />
      )}
      {/* Inner cross-hatch only for "all" */}
      {edges.all && (
        <>
          <line x1="1" y1="6"  x2="15" y2="6"  stroke={accent} strokeWidth={sw * 0.6} />
          <line x1="1" y1="10" x2="15" y2="10" stroke={accent} strokeWidth={sw * 0.6} />
          <line x1="6"  y1="1" x2="6"  y2="15" stroke={accent} strokeWidth={sw * 0.6} />
          <line x1="10" y1="1" x2="10" y2="15" stroke={accent} strokeWidth={sw * 0.6} />
        </>
      )}
    </svg>
  )
}

function PresetButton({ label, preset, iconColor, edges, thick, onPick }: PresetButtonProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={() => onPick(preset)}
      className="flex h-8 w-full items-center gap-2 rounded px-2 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <BorderIcon edges={edges} color={iconColor} {...(thick !== undefined && { thick })} />
      <span className="truncate">{label}</span>
    </button>
  )
}

/** Small palette of border colors — most-used 10. */
const BORDER_COLORS = [
  '#000000', '#7F7F7F', '#FF0000', '#FFC000',
  '#FFFF00', '#00B050', '#0070C0', '#7030A0',
  '#FFFFFF', '#C00000',
]

/** Line-style options mapped to FortuneSheet's style indices. */
const LINE_STYLES: { value: BorderLineStyle; label: string; preview: string }[] = [
  { value: '1', label: 'Thin',   preview: '─' },
  { value: '2', label: 'Medium', preview: '━' },
  { value: '4', label: 'Thick',  preview: '━' },
  { value: '3', label: 'Dashed', preview: '┄' },
]

export function BordersDropdown() {
  const [color, setColor] = useState('#000000')
  const [style, setStyle] = useState<BorderLineStyle>('1')
  const colorRef = useRef<HTMLInputElement>(null)

  function pick(preset: BorderPreset) {
    applyBorder(preset, { color, style })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Borders"
          className="flex h-[26px] items-center gap-0.5 rounded px-1 text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {/* Tiny preview using the current color */}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
          <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px] p-1">
        <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Borders
        </div>
        {/* 2-column preset grid */}
        <div className="grid grid-cols-2 gap-0.5">
          <PresetButton label="Bottom Border"    preset="bottom"  iconColor={color} edges={{ bottom: true }}  onPick={pick} />
          <PresetButton label="Top Border"       preset="top"     iconColor={color} edges={{ top: true }}     onPick={pick} />
          <PresetButton label="Left Border"      preset="left"    iconColor={color} edges={{ left: true }}    onPick={pick} />
          <PresetButton label="Right Border"     preset="right"   iconColor={color} edges={{ right: true }}   onPick={pick} />
          <PresetButton label="No Border"        preset="none"    iconColor={'#D4D4D8'} edges={{}}            onPick={pick} />
          <PresetButton label="All Borders"      preset="all"     iconColor={color} edges={{ all: true }}     onPick={pick} />
          <PresetButton label="Outside Borders"  preset="outside" iconColor={color} edges={{ outline: true }} onPick={pick} />
          <PresetButton label="Thick Box Border" preset="thick"   iconColor={color} edges={{ outline: true }} thick onPick={pick} />
        </div>

        {/* Divider */}
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />

        {/* Line Color row */}
        <div className="px-2 py-1">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Line Color
          </div>
          <div className="flex items-center gap-1">
            <div className="grid grid-cols-10 gap-1">
              {BORDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-4 w-4 rounded-sm border transition-transform hover:scale-110',
                    color.toLowerCase() === c.toLowerCase()
                      ? 'border-blue-500 ring-1 ring-blue-400'
                      : 'border-zinc-200 dark:border-zinc-700',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input
              ref={colorRef}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border border-zinc-200 bg-transparent p-0.5 dark:border-zinc-700"
              title="Custom line color"
            />
          </div>
        </div>

        {/* Line Style row */}
        <div className="px-2 py-1">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Line Style
          </div>
          <div className="flex items-center gap-1">
            {LINE_STYLES.map((ls) => (
              <button
                key={ls.value}
                type="button"
                title={ls.label}
                onClick={() => setStyle(ls.value)}
                className={cn(
                  'flex h-7 w-full items-center justify-center rounded border text-sm transition-colors',
                  style === ls.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
                )}
              >
                {ls.value === '4' ? <span className="text-base font-bold">━</span> :
                 ls.value === '2' ? <span className="text-sm font-semibold">─</span> :
                 ls.value === '3' ? <span className="tracking-widest">┄</span> :
                 <span className="text-[10px]">─</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Divider + More Borders */}
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
        <button
          type="button"
          onClick={ribbonStub('More Borders…')}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          More Borders…
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
