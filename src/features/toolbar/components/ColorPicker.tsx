'use client'

/**
 * ColorPicker — Excel-faithful split-button color picker.
 *
 * Anatomy (top-to-bottom):
 *
 *   ┌─────────────────────────────┐
 *   │  ☐  No Fill  /  Automatic   │   ← R2.1: clear-fill shortcut
 *   ├─────────────────────────────┤
 *   │  Theme Colors               │
 *   │  ▢▢▢▢▢▢▢▢▢▢                 │
 *   ├─────────────────────────────┤
 *   │  Standard Colors            │
 *   │  ▢▢▢▢▢▢▢▢▢▢                 │
 *   ├─────────────────────────────┤
 *   │  Recent Colors (if any)     │   ← R2.6 (light version)
 *   │  ▢▢▢▢▢▢                     │
 *   ├─────────────────────────────┤
 *   │  More Colors…  [picker + hex]│
 *   └─────────────────────────────┘
 *
 * Split-button behavior (R2.2):
 *   - The MAIN trigger (icon + colored bar) re-applies `lastAppliedColor`
 *     immediately without opening the picker. One click = re-color.
 *   - The CARET button (small chevron beside it) opens the picker.
 *   - On first use (no `lastAppliedColor` yet) the main button also
 *     opens the picker so the user can pick a starting color.
 *
 * Recent colors persist in localStorage at
 *   quiksheets_recent_colors:{label}
 * so each instance (Fill vs Text) maintains its own history.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Sentinel value meaning "no fill / automatic" — consumers should
 *  translate this to `undefined` / clear-out on apply. */
export const NO_FILL = '__no_fill__'

/** Excel's "Standard Colors" row — 10 saturated swatches. */
const STANDARD_COLORS = [
  '#C00000', // Dark Red
  '#FF0000', // Red
  '#FFC000', // Orange
  '#FFFF00', // Yellow
  '#92D050', // Light Green
  '#00B050', // Green
  '#00B0F0', // Light Blue
  '#0070C0', // Blue
  '#002060', // Dark Blue
  '#7030A0', // Purple
]

/** Excel's "Theme Colors" — 10 base hues, 6 tints (lighter→darker).
 *  We render only the base row in v1; the full 60-cell grid lands
 *  with Page Layout > Themes. */
const THEME_COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#E7E6E6', // Light Gray
  '#44546A', // Slate
  '#4472C4', // Blue
  '#ED7D31', // Orange
  '#A5A5A5', // Gray
  '#FFC000', // Gold
  '#5B9BD5', // Sky
  '#70AD47', // Green
]

const RECENT_LIMIT = 10

interface ColorPickerProps {
  /** Currently-applied color (hex). */
  value: string
  /** Called with a hex string, or `NO_FILL` for clear-out. */
  onChange: (color: string) => void
  /** What renders inside the main button (icon + accent strip). */
  trigger: React.ReactNode
  /** Tooltip + dropdown label, e.g. "Fill color" / "Text color". */
  label: string
  /** Whether to show "No Fill" / "Automatic" — true for backgrounds. */
  allowNoFill?: boolean
}

function loadRecent(label: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(`quiksheets_recent_colors:${label}`)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveRecent(label: string, list: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`quiksheets_recent_colors:${label}`, JSON.stringify(list))
  } catch {
    /* ignore quota / unavailable */
  }
}

export function ColorPicker({ value, onChange, trigger, label, allowNoFill = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value || '#000000')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const [lastApplied, setLastApplied] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Hydrate recent colors from storage when the dropdown first mounts.
  useEffect(() => {
    setRecent(loadRecent(label))
  }, [label])

  useEffect(() => {
    setCustomColor(value || '#000000')
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /** Apply a color, persist to recents, remember as last-applied. */
  function applyColor(color: string) {
    onChange(color)
    setLastApplied(color)
    if (color === NO_FILL) {
      setIsOpen(false)
      return
    }
    // Promote into recents (dedupe, MRU order).
    const next = [color, ...recent.filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, RECENT_LIMIT)
    setRecent(next)
    saveRecent(label, next)
    setIsOpen(false)
  }

  function openPicker() {
    if (caretRef.current) {
      // Anchor the dropdown to the caret button rather than the main
      // trigger so it aligns to the right edge of the split button.
      const r = caretRef.current.getBoundingClientRect()
      setRect(r)
    }
    setIsOpen(true)
  }

  function handleMainClick() {
    // R2.2: split-button behavior — re-apply last color OR open picker.
    if (lastApplied) {
      applyColor(lastApplied)
      return
    }
    openPicker()
  }

  // The accent bar under the icon shows whatever was last applied,
  // falling back to `value` so the button reflects the current cell.
  const accentColor = useMemo(() => {
    if (lastApplied && lastApplied !== NO_FILL) return lastApplied
    return value && value !== NO_FILL ? value : '#000000'
  }, [lastApplied, value])

  return (
    <>
      <div ref={wrapperRef} className="inline-flex h-7 items-stretch">
        <button
          type="button"
          onClick={handleMainClick}
          title={lastApplied && lastApplied !== NO_FILL ? `Apply ${lastApplied} (${label})` : label}
          className="flex flex-col items-center justify-center rounded-l px-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {trigger}
          <div
            className="mt-0.5 h-[3px] w-4 rounded-sm"
            style={{ backgroundColor: accentColor }}
          />
        </button>
        <button
          ref={caretRef}
          type="button"
          onClick={openPicker}
          title={`${label} options`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="flex w-3.5 items-center justify-center rounded-r text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>

      {isOpen && rect && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 2,
            // Anchor to right edge of caret so the menu doesn't overflow.
            left: Math.max(8, rect.right - 232),
            width: 232,
            zIndex: 9999,
          }}
          className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {/* R2.1 — No Fill / Automatic */}
          {allowNoFill && (
            <button
              type="button"
              onClick={() => applyColor(NO_FILL)}
              className="mb-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white text-[10px] text-red-500">
                ✕
              </span>
              No Fill
            </button>
          )}

          {/* Theme Colors */}
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
            Theme Colors
          </div>
          <div className="mb-2 grid grid-cols-10 gap-1">
            {THEME_COLORS.map((c) => (
              <button
                key={`theme-${c}`}
                type="button"
                onClick={() => applyColor(c)}
                title={c}
                className={cn(
                  'h-4 w-4 rounded-sm border transition-transform hover:scale-110',
                  value.toLowerCase() === c.toLowerCase()
                    ? 'border-blue-500 ring-1 ring-blue-400'
                    : 'border-zinc-200 dark:border-zinc-700',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Standard Colors */}
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
            Standard Colors
          </div>
          <div className="mb-2 grid grid-cols-10 gap-1">
            {STANDARD_COLORS.map((c) => (
              <button
                key={`std-${c}`}
                type="button"
                onClick={() => applyColor(c)}
                title={c}
                className={cn(
                  'h-4 w-4 rounded-sm border transition-transform hover:scale-110',
                  value.toLowerCase() === c.toLowerCase()
                    ? 'border-blue-500 ring-1 ring-blue-400'
                    : 'border-zinc-200 dark:border-zinc-700',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Recent Colors (only when populated) */}
          {recent.length > 0 && (
            <>
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Recent Colors
              </div>
              <div className="mb-2 grid grid-cols-10 gap-1">
                {recent.map((c) => (
                  <button
                    key={`recent-${c}`}
                    type="button"
                    onClick={() => applyColor(c)}
                    title={c}
                    className={cn(
                      'h-4 w-4 rounded-sm border transition-transform hover:scale-110',
                      value.toLowerCase() === c.toLowerCase()
                        ? 'border-blue-500 ring-1 ring-blue-400'
                        : 'border-zinc-200 dark:border-zinc-700',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </>
          )}

          {/* More Colors — inline hex + native picker */}
          <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
              More Colors
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border border-zinc-200 bg-transparent p-0.5 dark:border-zinc-700"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyColor(customColor)
                }}
                placeholder="#000000"
                className="flex-1 rounded border border-zinc-200 px-2 py-1 font-mono text-xs outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
              <button
                type="button"
                onClick={() => applyColor(customColor)}
                className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
