'use client'

import React, { useEffect, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { cn } from '@/lib/utils'
import { colIndexToLetter } from '@/lib/cellAddress'
import type { SortDirection } from '@/types/sheet.types'

interface SortPanelProps {
  isOpen: boolean
  onClose: () => void
  totalColumns: number
}

export function SortPanel({ isOpen, onClose, totalColumns }: SortPanelProps) {
  const { applySort } = useSheetStore()
  const [selectedCol, setSelectedCol] = useState(0)
  const [direction, setDirection] = useState<SortDirection>('asc')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const columns = Array.from({ length: totalColumns }, (_, index) => ({
    index,
    label: `Column ${colIndexToLetter(index)}`,
  }))

  function handleApply() {
    applySort({ columnIndex: selectedCol, direction })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-[360px] rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Sort Range</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-zinc-600">
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Sort by column</label>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400"
            >
              {columns.map((column) => (
                <option key={column.index} value={column.index}>
                  {column.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Order</label>
            <div className="flex gap-2">
              {([
                { value: 'asc', label: 'A to Z (Ascending)' },
                { value: 'desc', label: 'Z to A (Descending)' },
              ] as { value: SortDirection; label: string }[]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDirection(option.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-blue-300',
                    direction === option.value
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 text-zinc-600'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs text-white hover:bg-zinc-700"
          >
            Apply Sort
          </button>
        </div>
      </div>
    </div>
  )
}
