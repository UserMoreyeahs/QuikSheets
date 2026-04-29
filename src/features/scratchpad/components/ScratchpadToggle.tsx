'use client'

import { NotebookPen } from 'lucide-react'

interface ScratchpadToggleProps {
  isOpen: boolean
  onToggle: () => void
}

export function ScratchpadToggle({ isOpen, onToggle }: ScratchpadToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Private Scratchpad (Ctrl+`)"
      aria-label="Private Scratchpad"
      aria-pressed={isOpen}
      className={[
        'fixed bottom-4 right-4 z-[97] flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors',
        isOpen
          ? 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
      ].join(' ')}
    >
      <NotebookPen className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
