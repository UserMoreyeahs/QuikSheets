'use client'

import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { HistoryEntry } from '@/features/cell-history/components/HistoryEntry'
import type { CellHistoryEntry as CellHistoryEntryData } from '@/features/cell-history/services/historyService'

interface CellHistoryPanelProps {
  cellAddress: string | null
  entries: CellHistoryEntryData[]
  isLoading: boolean
  isOpen: boolean
  isRestoring: boolean
  onClose: () => void
  onRestore: (historyId: string) => void
}

function entryMatchesDate(entry: CellHistoryEntryData, dateFilter: string): boolean {
  if (!dateFilter) return true
  const changedAt = new Date(entry.changed_at)
  if (Number.isNaN(changedAt.getTime())) return false
  return changedAt.toISOString().slice(0, 10) === dateFilter
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 py-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border-l border-zinc-200 pl-4">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="mt-3 flex gap-2">
            <div className="h-7 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="h-7 w-5 animate-pulse rounded bg-zinc-100" />
            <div className="h-7 w-20 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="mt-3 h-7 w-full animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  )
}

export function CellHistoryPanel({
  cellAddress,
  entries,
  isLoading,
  isOpen,
  isRestoring,
  onClose,
  onRestore,
}: CellHistoryPanelProps) {
  const [dateFilter, setDateFilter] = useState('')

  const filteredEntries = useMemo(
    () => entries.filter((entry) => entryMatchesDate(entry, dateFilter)),
    [dateFilter, entries]
  )

  return (
    <aside
      className={[
        'fixed right-0 top-0 z-[90] flex h-screen w-[320px] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-hidden={!isOpen}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
        <h2 className="min-w-0 truncate text-sm font-semibold text-zinc-900">
          Cell {cellAddress ?? ''} History
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Close cell history"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className="min-w-0 flex-1 rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setDateFilter('')}
          className="rounded border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!dateFilter}
        >
          Clear
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredEntries.length > 0 ? (
          <ol className="px-5 py-5">
            {filteredEntries.map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                isRestoring={isRestoring}
                onRestore={onRestore}
              />
            ))}
          </ol>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
            No changes recorded for this cell
          </div>
        )}
      </div>
    </aside>
  )
}
