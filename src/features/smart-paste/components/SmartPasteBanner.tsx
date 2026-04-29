'use client'

import React, { useEffect } from 'react'
import { Check, Pencil, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SmartPasteColumn } from '@/features/smart-paste/hooks/useSmartPaste'

interface SmartPasteBannerProps {
  columns: SmartPasteColumn[]
  detectedStructure: string
  isApplying: boolean
  onConfirm: () => void
  onKeepRaw: () => void
  onEditDetection: () => void
  onDismiss: () => void
}

export function SmartPasteBanner({
  columns,
  detectedStructure,
  isApplying,
  onConfirm,
  onKeepRaw,
  onEditDetection,
  onDismiss,
}: SmartPasteBannerProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 8000)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="absolute left-4 right-4 top-3 z-[85] animate-[smartPasteSlide_180ms_ease-out] rounded-lg border border-blue-200 bg-white px-3 py-2 shadow-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
          <Sparkles size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-900">Smart paste detected</span>
            <span className="truncate text-[11px] text-zinc-500">{detectedStructure}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {columns.slice(0, 8).map((column) => (
              <span
                key={`${column.name}-${column.type}`}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700"
              >
                {column.name}
                <span className="ml-1 text-zinc-400">{column.type}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isApplying}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded bg-blue-600 px-3 text-xs font-medium text-white',
              'hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70'
            )}
          >
            <Check size={14} />
            Yes, Format It
          </button>
          <button
            type="button"
            onClick={onKeepRaw}
            className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            <X size={14} />
            Keep Raw
          </button>
          <button
            type="button"
            onClick={onEditDetection}
            className="flex h-8 items-center gap-1.5 rounded px-2 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            <Pencil size={14} />
            Edit Detection
          </button>
        </div>
      </div>
    </div>
  )
}
