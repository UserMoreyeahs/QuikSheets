'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'

const PALETTES = [
  // Light
  { name: 'Light Blue',   bg: '#DDEBF7', header: '#5B9BD5', alt: '#FFFFFF' },
  { name: 'Light Orange', bg: '#FCE4D6', header: '#ED7D31', alt: '#FFFFFF' },
  { name: 'Light Gray',   bg: '#EDEDED', header: '#A5A5A5', alt: '#FFFFFF' },
  { name: 'Light Yellow', bg: '#FFF2CC', header: '#FFC000', alt: '#FFFFFF' },
  { name: 'Light Green',  bg: '#E2EFDA', header: '#70AD47', alt: '#FFFFFF' },
  { name: 'Light Red',    bg: '#FCE4E4', header: '#C00000', alt: '#FFFFFF' },
  // Medium
  { name: 'Med Blue',     bg: '#9DC3E6', header: '#2E75B6', alt: '#DDEBF7' },
  { name: 'Med Orange',   bg: '#F4B183', header: '#C55A11', alt: '#FCE4D6' },
  { name: 'Med Gray',     bg: '#BFBFBF', header: '#7F7F7F', alt: '#EDEDED' },
  { name: 'Med Yellow',   bg: '#FFD966', header: '#BF8F00', alt: '#FFF2CC' },
  { name: 'Med Green',    bg: '#A9D08E', header: '#548235', alt: '#E2EFDA' },
  { name: 'Med Red',      bg: '#F4B0B0', header: '#823535', alt: '#FCE4E4' },
  // Dark
  { name: 'Dark Blue',    bg: '#2E75B6', header: '#1F4E79', alt: '#FFFFFF' },
  { name: 'Dark Orange',  bg: '#C55A11', header: '#833C0C', alt: '#FFFFFF' },
  { name: 'Dark Gray',    bg: '#595959', header: '#262626', alt: '#FFFFFF' },
  { name: 'Dark Yellow',  bg: '#BF8F00', header: '#806000', alt: '#FFFFFF' },
  { name: 'Dark Green',   bg: '#548235', header: '#385723', alt: '#FFFFFF' },
  { name: 'Dark Red',     bg: '#823535', header: '#491D1D', alt: '#FFFFFF' },
]

export function FormatAsTableDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { selectedCell, selectedRange, applyFormatToSelection } = useSheetStore()

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const apply = (palette: (typeof PALETTES)[number]) => {
    // Apply alternating row colors and a header row to the selected range
    if (!selectedCell) return
    const r = selectedRange
    const sr = r ? Math.min(r.start.row, r.end.row) : selectedCell.row
    const er = r ? Math.max(r.start.row, r.end.row) : selectedCell.row
    const sc = r ? Math.min(r.start.col, r.end.col) : selectedCell.col
    const ec = r ? Math.max(r.start.col, r.end.col) : selectedCell.col

    // Header (first row): bg = header color, white text, bold
    const { gridInstance } = useSheetStore.getState()
    if (gridInstance) {
      try {
        gridInstance.setCellFormatByRange('bg', palette.header, [{ row: [sr, sr], column: [sc, ec] }])
        gridInstance.setCellFormatByRange('fc', '#FFFFFF',          [{ row: [sr, sr], column: [sc, ec] }])
        gridInstance.setCellFormatByRange('bl', 1,                   [{ row: [sr, sr], column: [sc, ec] }])
        // Body rows: alternate
        for (let row = sr + 1; row <= er; row += 1) {
          const bg = (row - sr) % 2 === 1 ? palette.bg : palette.alt
          gridInstance.setCellFormatByRange('bg', bg, [{ row: [row, row], column: [sc, ec] }])
        }
      } catch {
        applyFormatToSelection({ backgroundColor: palette.bg })
      }
    } else {
      applyFormatToSelection({ backgroundColor: palette.bg })
    }
    setOpen(false)
  }

  const triggerRect = triggerRef.current?.getBoundingClientRect()

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        title="Format as Table"
        aria-label="Format as Table"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-[68px] w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded px-1 py-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          open
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60',
        )}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <rect x="2" y="3"  width="20" height="4" fill="#5B9BD5" />
          <rect x="2" y="8"  width="20" height="4" fill="#DDEBF7" />
          <rect x="2" y="13" width="20" height="4" fill="#FFFFFF" stroke="#A5A5A5" strokeWidth="0.5" />
          <rect x="2" y="18" width="20" height="3" fill="#DDEBF7" />
        </svg>
        <div className="flex flex-col items-center leading-[1.05]">
          <span className="text-[10px]">Format as</span>
          <span className="flex items-center gap-0.5 text-[10px]">
            Table
            <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />
          </span>
        </div>
      </button>

      {open && triggerRect && (
        <div
          className="fixed rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{ zIndex: 300, top: triggerRect.bottom + 4, left: triggerRect.left, width: 360 }}
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Light · Medium · Dark
          </p>
          <div className="grid grid-cols-6 gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                onClick={() => apply(p)}
                className="h-12 w-12 overflow-hidden rounded border border-zinc-200 transition-all hover:border-blue-400 hover:ring-1 hover:ring-blue-300 dark:border-zinc-600"
              >
                <div style={{ height: 4, background: p.header }} />
                <div style={{ height: 14, background: p.bg }} />
                <div style={{ height: 14, background: p.alt }} />
                <div style={{ height: 14, background: p.bg }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
