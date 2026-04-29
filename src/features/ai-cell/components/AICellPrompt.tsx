'use client'

import React, { KeyboardEvent, useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CellAddress } from '@/types/sheet.types'

interface AICellPromptProps {
  cellAddress: string
  selectedCell: CellAddress | null
  isLoading: boolean
  error: string | null
  formula: string
  explanation: string
  onGenerate: (instruction: string) => void
  onAccept: () => void
  onCancel: () => void
}

function getPanelPosition(selectedCell: CellAddress | null) {
  if (typeof window === 'undefined') {
    return { left: 152, top: 160 }
  }

  const row = selectedCell?.row ?? 0
  const col = selectedCell?.col ?? 0
  const left = Math.min(
    Math.max(112, 48 + col * DEFAULT_CELL_WIDTH),
    window.innerWidth - 396
  )
  const top = Math.min(
    Math.max(148, 128 + (row + 1) * DEFAULT_CELL_HEIGHT),
    window.innerHeight - 260
  )

  return { left, top }
}

export function AICellPrompt({
  cellAddress,
  selectedCell,
  isLoading,
  error,
  formula,
  explanation,
  onGenerate,
  onAccept,
  onCancel,
}: AICellPromptProps) {
  const [instruction, setInstruction] = useState('')
  const position = useMemo(() => getPanelPosition(selectedCell), [selectedCell])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }

    if (event.key === 'Tab' && formula) {
      event.preventDefault()
      onAccept()
    }

    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault()
      onGenerate(instruction)
    }
  }

  return (
    <div
      style={{ left: position.left, top: position.top, width: 380 }}
      className="fixed z-[80] rounded-lg border border-blue-200 bg-white p-3 shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-50 text-blue-600">
            <Sparkles size={15} />
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-900">AI formula</div>
            <div className="font-mono text-[11px] text-zinc-500">{cellAddress}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          Esc
        </button>
      </div>

      <div className="flex gap-2">
        <input
          autoFocus
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want this formula to do..."
          className="h-9 min-w-0 flex-1 rounded border border-zinc-200 px-3 text-sm text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => onGenerate(instruction)}
          disabled={isLoading}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded bg-blue-600 px-3 text-xs font-medium text-white',
            'hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70'
          )}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generate
        </button>
      </div>

      {isLoading && (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {formula && (
        <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <code className="truncate font-mono text-xs text-zinc-900">{formula}</code>
            <button
              type="button"
              onClick={onAccept}
              title={explanation || 'Press Tab to accept'}
              className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-700"
            >
              Tab
            </button>
          </div>
          {explanation && <p className="mt-2 text-xs leading-5 text-zinc-600">{explanation}</p>}
        </div>
      )}
    </div>
  )
}
