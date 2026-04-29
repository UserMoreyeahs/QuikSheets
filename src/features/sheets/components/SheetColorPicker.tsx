'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface SheetColorPickerProps {
  currentColor: string | null
  onChange: (color: string | null) => void
}

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#84cc16',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
  '#f59e0b',
  '#10b981',
  '#64748b',
]

export function SheetColorPicker({ currentColor, onChange }: SheetColorPickerProps) {
  return (
    <div className="p-2">
      <div className="mb-2 text-xs font-medium text-zinc-500">Tab color</div>
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          title="No color"
          onClick={() => onChange(null)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-400 transition-all hover:border-zinc-500',
            currentColor === null && 'ring-2 ring-blue-500 ring-offset-1'
          )}
        >
          <span className="text-[10px]">X</span>
        </button>

        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'h-6 w-6 rounded border border-transparent transition-all hover:scale-110',
              currentColor === color && 'ring-2 ring-blue-500 ring-offset-1'
            )}
          />
        ))}
      </div>
    </div>
  )
}
