'use client'

import { Lock, Trash2, X } from 'lucide-react'
import type { Sheet } from '@fortune-sheet/core'
import { ScratchpadGrid } from '@/features/scratchpad/components/ScratchpadGrid'

interface ScratchpadPanelProps {
  data: Sheet[]
  isOpen: boolean
  mainSheetData: Sheet | null | undefined
  onChange: (data: Sheet[]) => void
  onClear: () => void
  onClose: () => void
}

export function ScratchpadPanel({
  data,
  isOpen,
  mainSheetData,
  onChange,
  onClear,
  onClose,
}: ScratchpadPanelProps) {
  return (
    <aside
      className={[
        'fixed right-0 top-0 z-[96] flex h-screen w-[400px] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-hidden={!isOpen}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Lock className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold text-zinc-900">Private Scratchpad</h2>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
            never shared
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear the private scratchpad for this sheet?')) {
                onClear()
              }
            }}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="Clear scratchpad"
            title="Clear scratchpad"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close scratchpad"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ScratchpadGrid data={data} mainSheetData={mainSheetData} onChange={onChange} />
      </div>
    </aside>
  )
}
