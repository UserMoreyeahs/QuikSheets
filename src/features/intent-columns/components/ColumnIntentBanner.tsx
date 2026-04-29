'use client'

import React, { useEffect } from 'react'
import { Check, SlidersHorizontal, X } from 'lucide-react'
import type { ColumnIntent } from '@/features/intent-columns/utils/columnIntent'

interface ColumnIntentBannerProps {
  intent: ColumnIntent
  header: string
  position: { left: number; top: number }
  onKeep: () => void
  onChange: () => void
  onDismiss: () => void
}

export function ColumnIntentBanner({
  intent,
  header,
  position,
  onKeep,
  onChange,
  onDismiss,
}: ColumnIntentBannerProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      style={{ left: position.left, top: position.top }}
      className="absolute z-[88] animate-[columnIntentSlide_160ms_ease-out] rounded-lg border border-blue-200 bg-white px-3 py-2 shadow-xl"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-900">
            We set this column as {intent.suggestion}.
          </div>
          <div className="max-w-[260px] truncate text-[11px] text-zinc-500">{header}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onKeep}
            className="flex h-7 items-center gap-1 rounded bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Check size={13} />
            Keep
          </button>
          <button
            type="button"
            onClick={onChange}
            className="flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            <SlidersHorizontal size={13} />
            Change
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
