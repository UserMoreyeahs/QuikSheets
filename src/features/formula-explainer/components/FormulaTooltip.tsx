'use client'

import React from 'react'
import { Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormulaTooltipProps {
  formula: string
  explanation: string
  dependencies: string[]
  sensitivityNote: string
  isLoading: boolean
  isPinned: boolean
  position: { left: number; top: number }
  onPinToggle: () => void
  onDependencyClick?: (reference: string) => void
}

export function FormulaTooltip({
  formula,
  explanation,
  dependencies,
  sensitivityNote,
  isLoading,
  isPinned,
  position,
  onPinToggle,
  onDependencyClick,
}: FormulaTooltipProps) {
  return (
    <div
      style={{ left: position.left, top: position.top, maxWidth: 380 }}
      className="fixed z-[90] w-[380px] rounded-lg border border-blue-200 bg-white p-3 shadow-2xl"
    >
      <div className="absolute -top-2 left-5 h-4 w-4 rotate-45 border-l border-t border-blue-200 bg-white" />
      <button
        type="button"
        onClick={onPinToggle}
        title={isPinned ? 'Unpin explanation' : 'Pin explanation'}
        className={cn(
          'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded',
          'text-zinc-400 hover:bg-blue-50 hover:text-blue-600'
        )}
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>

      <div className="pr-8">
        <code className="block truncate rounded bg-zinc-100 px-2 py-1.5 font-mono text-xs text-zinc-900">
          {formula}
        </code>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-zinc-100" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-5 text-zinc-700">{explanation}</p>

          {dependencies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dependencies.map((dependency) => (
                <button
                  key={dependency}
                  type="button"
                  onClick={() => onDependencyClick?.(dependency)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700 hover:bg-blue-100"
                >
                  {dependency}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs italic leading-5 text-zinc-500">{sensitivityNote}</p>
        </div>
      )}
    </div>
  )
}
