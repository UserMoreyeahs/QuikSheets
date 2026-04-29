'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { searchFormulas, CATEGORY_COLORS } from '../formulaList'
import type { FormulaEntry } from '../formulaList'

interface FormulaAutocompleteProps {
  query: string
  anchorRef: React.RefObject<HTMLElement>
  onSelect: (formula: FormulaEntry) => void
  onClose: () => void
}

export function FormulaAutocomplete({
  query,
  anchorRef,
  onSelect,
  onClose,
}: FormulaAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const term = query.startsWith('=') ? query.slice(1) : query
  const results = searchFormulas(term)
  const active = results[activeIndex] ?? results[0] ?? null

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useLayoutEffect(() => {
    setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null)
  }, [anchorRef, query])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!results.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (active) {
          e.preventDefault()
          onSelect(active)
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [results, active, onSelect, onClose])

  if (!results.length) return null

  if (!anchorRect) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 2,
        left: anchorRect.left,
        width: 560,
        zIndex: 9999,
      }}
      className="flex overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xl"
    >
      <div
        ref={listRef}
        className="w-44 shrink-0 overflow-y-auto border-r border-zinc-100 py-1"
        style={{ maxHeight: 280 }}
      >
        {results.map((entry, idx) => (
          <button
            key={entry.name}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(entry)
            }}
            onMouseEnter={() => setActiveIndex(idx)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-mono',
              'transition-colors duration-75',
              idx === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-zinc-700 hover:bg-zinc-50'
            )}
          >
            <span
              className={cn(
                'shrink-0 rounded px-1 py-0.5 text-[10px] font-medium font-sans',
                CATEGORY_COLORS[entry.category]
              )}
            >
              {entry.category.slice(0, 3)}
            </span>
            {entry.name}
          </button>
        ))}
      </div>

      {active && (
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-800">{active.name}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                CATEGORY_COLORS[active.category]
              )}
            >
              {active.category}
            </span>
          </div>
          <code className="break-all rounded bg-zinc-50 px-2 py-1 font-mono text-[11px] leading-relaxed text-zinc-600">
            {active.syntax}
          </code>
          <p className="text-xs leading-relaxed text-zinc-500">{active.description}</p>
          <div className="mt-auto">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Example
            </span>
            <code className="mt-0.5 block font-mono text-xs text-zinc-700">{active.example}</code>
          </div>
          <p className="text-[10px] text-zinc-300">Tab or Enter to insert, Esc to dismiss</p>
        </div>
      )}
    </div>
  )
}
