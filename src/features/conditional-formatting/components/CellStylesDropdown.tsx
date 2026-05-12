'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Paintbrush, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'
import { CELL_STYLE_PRESETS } from '../constants/presets'

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

  const handleApplyStyle = (preset: (typeof CELL_STYLE_PRESETS)[number]) => {
    applyFormatToSelection({
      ...(preset.bold !== undefined ? { bold: preset.bold } : {}),
      ...(preset.fill !== undefined ? { backgroundColor: preset.fill } : {}),
      ...(preset.color !== undefined ? { textColor: preset.color } : {}),
      ...(preset.fontSize !== undefined ? { fontSize: preset.fontSize } : {}),
    })
    setIsOpen(false)
  }

  const triggerRect = triggerRef.current?.getBoundingClientRect()

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button — Excel-style large stacked button with caret */}
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
            : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60'
        )}
      >
        {/* Excel-style Cell Styles icon: paintbrush over swatch */}
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <rect x="2" y="13" width="20" height="8" rx="1" fill="#A78BFA" />
          <rect x="2" y="3"  width="20" height="8" rx="1" fill="#C4B5FD" />
          <Paintbrush className="hidden" />
        </svg>
        <div className="flex items-center gap-0.5 leading-none">
          <span className="text-[10px]">Cell Styles</span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />
        </div>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="fixed min-w-[300px] rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            zIndex: 300,
            top: triggerRect ? triggerRect.bottom + 4 : 0,
            left: triggerRect ? triggerRect.left : 0,
          }}
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Cell Styles
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CELL_STYLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyStyle(preset)}
                className="flex h-14 flex-col items-center justify-center rounded-md border border-zinc-200 px-2 py-1.5 transition-all hover:border-blue-400 hover:shadow-md dark:border-zinc-700 dark:hover:border-blue-500"
                style={{
                  backgroundColor: preset.fill ?? 'transparent',
                }}
              >
                <span
                  className="truncate text-xs leading-tight"
                  style={{
                    color: preset.color ?? 'inherit',
                    fontWeight: preset.bold ? 700 : 400,
                    fontSize: preset.fontSize
                      ? `${Math.min(preset.fontSize, 13)}px`
                      : '12px',
                  }}
                >
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
