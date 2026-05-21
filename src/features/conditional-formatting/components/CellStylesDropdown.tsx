'use client'

/**
 * CellStylesDropdown — Excel-faithful Cell Styles gallery.
 *
 * Renders the 30+ presets grouped into Excel's five categories:
 *   - Good, Bad and Neutral
 *   - Data and Model
 *   - Titles and Headings
 *   - Themed Cell Styles
 *   - Number Format
 *
 * Each section header is a dim, uppercase chip; presets render as a
 * 4-column grid of swatch buttons that PREVIEW the style themselves
 * (background fill + foreground colour + font weight + size + italic).
 * The Number Format section renders the format STRING as the swatch
 * label since those presets have no colour cues to preview from.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'
import { CELL_STYLE_PRESETS } from '../constants/presets'
import type { CFCellStylePreset, CellStyleCategory } from '../types'
import { applyCustomNumberFormat } from '@/features/ribbon/utils/cellOps'

const CATEGORY_ORDER: CellStyleCategory[] = [
  'Good, Bad and Neutral',
  'Data and Model',
  'Titles and Headings',
  'Themed Cell Styles',
  'Number Format',
]

export function CellStylesDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { applyFormatToSelection } = useSheetStore()

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Group presets by category once per render.
  const grouped = useMemo(() => {
    const out = new Map<CellStyleCategory | '_uncategorised', CFCellStylePreset[]>()
    for (const p of CELL_STYLE_PRESETS) {
      const key: CellStyleCategory | '_uncategorised' = p.category ?? '_uncategorised'
      const list = out.get(key) ?? []
      list.push(p)
      out.set(key, list)
    }
    return out
  }, [])

  const handleApplyStyle = (preset: CFCellStylePreset) => {
    // 1) Apply visual style fields (fill / colour / bold / italic / fontSize).
    applyFormatToSelection({
      ...(preset.bold !== undefined ? { bold: preset.bold } : {}),
      ...(preset.italic !== undefined ? { italic: preset.italic } : {}),
      ...(preset.fill !== undefined ? { backgroundColor: preset.fill } : {}),
      ...(preset.color !== undefined ? { textColor: preset.color } : {}),
      ...(preset.fontSize !== undefined ? { fontSize: preset.fontSize } : {}),
    })
    // 2) Apply number format if the preset carries one.
    if (preset.numberFormat) {
      applyCustomNumberFormat(preset.numberFormat)
    }
    setIsOpen(false)
  }

  const triggerRect = triggerRef.current?.getBoundingClientRect()

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Cell Styles"
        title="Cell Styles"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative flex h-[68px] w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded px-1 py-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          isOpen
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60',
        )}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <rect x="2"  y="3"  width="20" height="8" rx="1" fill="#C4B5FD" />
          <rect x="2"  y="13" width="20" height="8" rx="1" fill="#A78BFA" />
        </svg>
        <div className="flex items-center gap-0.5 leading-none">
          <span className="text-[10px]">Cell Styles</span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed w-[400px] max-h-[480px] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            zIndex: 300,
            top: triggerRect ? triggerRect.bottom + 4 : 0,
            left: triggerRect ? triggerRect.left : 0,
          }}
        >
          {CATEGORY_ORDER.map((cat) => {
            const presets = grouped.get(cat) ?? []
            if (presets.length === 0) return null
            return (
              <section key={cat} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {cat}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {presets.map((preset) => (
                    <PresetSwatch key={preset.label} preset={preset} onApply={handleApplyStyle} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Individual swatch — renders the preset's actual visual style so the
 * user sees what they're picking. Number-format presets fall back to
 * showing the format string in monospace since they have no colour.
 */
function PresetSwatch({
  preset,
  onApply,
}: {
  preset: CFCellStylePreset
  onApply: (p: CFCellStylePreset) => void
}) {
  const isNumberFormat = preset.category === 'Number Format'
  return (
    <button
      type="button"
      onClick={() => onApply(preset)}
      title={preset.label + (preset.numberFormat ? ` (${preset.numberFormat})` : '')}
      className="flex h-[42px] flex-col items-center justify-center rounded-md border border-zinc-200 px-1.5 py-1 transition-all hover:border-blue-400 hover:shadow-md dark:border-zinc-700 dark:hover:border-blue-500"
      style={{
        backgroundColor: preset.fill ?? 'transparent',
        ...(preset.borderBottom ? { borderBottom: preset.borderBottom } : {}),
      }}
    >
      <span
        className="block truncate text-center"
        style={{
          color: preset.color ?? 'inherit',
          fontWeight: preset.bold ? 700 : 400,
          fontStyle: preset.italic ? 'italic' : 'normal',
          fontSize: '11px', // keep gallery legible; actual cell uses preset.fontSize
          maxWidth: '78px',
        }}
      >
        {preset.label}
      </span>
      {isNumberFormat && preset.numberFormat && (
        <span className="mt-0.5 block font-mono text-[9px] text-zinc-500 dark:text-zinc-400">
          {preset.numberFormat}
        </span>
      )}
    </button>
  )
}
