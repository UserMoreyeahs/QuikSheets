'use client'

/**
 * SymbolPicker — Excel-equivalent of Insert > Symbol.
 *
 * A categorised Unicode picker that inserts the chosen symbol into the
 * active cell at the end of its current value (Excel inserts at the caret
 * inside the formula bar; since we don't track caret position here we
 * append, which matches the behaviour users get when no cell is in edit
 * mode and they pick a single symbol).
 *
 * Categories cover the most-used Excel symbol families: currency, math,
 * arrows, Greek letters, punctuation, and a small misc set (checkmarks,
 * stars, bullet shapes).
 */

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useSymbolPickerStore } from '../store/symbolPickerStore'
import { useSheetStore } from '@/store/sheetStore'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SymbolGroup {
  label: string
  symbols: string[]
}

const GROUPS: SymbolGroup[] = [
  {
    label: 'Currency',
    symbols: [
      '$', '€', '£', '¥', '₹', '₽', '₩', '₪', '₫', '₱',
      '฿', '₺', '₦', '₴', '₲', '₡', '₵', '₸', '₼', '₾',
      '¢', '₠', '₢', '₣', '₤', '₥', '₧', '₨', '₯', '₶',
    ],
  },
  {
    label: 'Math',
    symbols: [
      '±', '×', '÷', '=', '≠', '≈', '≡', '<', '>', '≤',
      '≥', '∞', '∑', '∏', '√', '∛', '∜', '∫', '∂', '∇',
      '∆', 'π', 'µ', '°', '%', '‰', '′', '″', '‴', '∝',
      '∈', '∉', '⊂', '⊃', '⊆', '⊇', '∩', '∪', '∅', '∧',
    ],
  },
  {
    label: 'Arrows',
    symbols: [
      '←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙',
      '⇐', '⇒', '⇑', '⇓', '⇔', '⇕', '↩', '↪', '⤴', '⤵',
      '⇆', '⇄', '⇅', '⇈', '⇉', '⇊', '⇍', '⇎', '⇏', '⇗',
    ],
  },
  {
    label: 'Greek',
    symbols: [
      'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ',
      'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ',
      'φ', 'χ', 'ψ', 'ω',
      'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ',
      'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ',
      'Φ', 'Χ', 'Ψ', 'Ω',
    ],
  },
  {
    label: 'Punctuation',
    symbols: [
      '…', '–', '—', '•', '·', '«', '»', '‘', '’', '“',
      '”', '„', '‚', '‹', '›', '¡', '¿', '§', '¶', '†',
      '‡', '©', '®', '™', '℠', '№', '℅', '⁂', '⁕', '⁘',
    ],
  },
  {
    label: 'Misc',
    symbols: [
      '✓', '✔', '✗', '✘', '☑', '☒', '☐', '♥', '♦', '♣',
      '♠', '★', '☆', '✦', '✧', '✪', '✫', '✬', '✭', '✮',
      '☀', '☁', '☂', '☃', '☎', '☏', '✉', '⚠', '⚡', '⌘',
      '←', '→', '↑', '↓', '◆', '◇', '■', '□', '●', '○',
    ],
  },
]

export function SymbolPicker() {
  const open = useSymbolPickerStore((s) => s.open)
  const closePicker = useSymbolPickerStore((s) => s.closePicker)
  const gridInstance = useSheetStore((s) => s.gridInstance)
  const selectedCell = useSheetStore((s) => s.selectedCell)

  const [activeTab, setActiveTab] = useState<string>(GROUPS[0]?.label ?? 'Currency')
  const [query, setQuery] = useState('')

  const visibleGroups = useMemo<SymbolGroup[]>(() => {
    const needle = query.trim()
    if (!needle) {
      const single = GROUPS.find((g) => g.label === activeTab)
      return single ? [single] : []
    }
    // Search across all groups: char match or codepoint match (U+XXXX or hex).
    const lower = needle.toLowerCase()
    return GROUPS.map((g) => ({
      label: g.label,
      symbols: g.symbols.filter((s) => {
        if (s === needle) return true
        const code = s.codePointAt(0)
        if (code === undefined) return false
        const hex = code.toString(16).toLowerCase()
        return hex.includes(lower.replace(/^u\+?/i, '').replace(/^0x/i, ''))
      }),
    })).filter((g) => g.symbols.length > 0)
  }, [activeTab, query])

  function insertSymbol(symbol: string): void {
    if (!gridInstance || !selectedCell) {
      toast.message('Select a cell first')
      return
    }
    const inst = gridInstance as unknown as {
      getCellValue?: (r: number, c: number) => unknown
      setCellValue: (r: number, c: number, v: string) => void
    }
    const existing = (() => {
      try {
        const v = inst.getCellValue?.(selectedCell.row, selectedCell.col)
        if (v == null) return ''
        if (typeof v === 'string' || typeof v === 'number') return String(v)
        // FortuneSheet may hand back a CellData-shaped object
        const obj = v as { v?: unknown; m?: unknown }
        if (obj.v != null) return String(obj.v)
        if (obj.m != null) return String(obj.m)
        return ''
      } catch {
        return ''
      }
    })()
    inst.setCellValue(selectedCell.row, selectedCell.col, `${existing}${symbol}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closePicker()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Symbol</DialogTitle>
          <DialogDescription>
            Click a symbol to insert it into the active cell. Searching by
            Unicode hex (e.g. <span className="font-mono">20ac</span>) filters
            across all categories.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by hex code…"
            className="flex h-8 w-full rounded border border-zinc-300 bg-background px-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700"
          />
        </div>

        {!query && (
          <div className="flex flex-wrap gap-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
            {GROUPS.map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveTab(g.label)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs',
                  activeTab === g.label
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[360px] overflow-y-auto">
          {visibleGroups.map((g) => (
            <div key={g.label} className="mb-3">
              {query && (
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {g.label}
                </div>
              )}
              <div className="grid grid-cols-10 gap-1">
                {g.symbols.map((s, idx) => (
                  <button
                    key={`${g.label}-${idx}-${s}`}
                    type="button"
                    onClick={() => insertSymbol(s)}
                    title={`U+${(s.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`}
                    className="flex h-9 items-center justify-center rounded border border-transparent text-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {visibleGroups.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-500">
              No symbols match that filter.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closePicker}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
