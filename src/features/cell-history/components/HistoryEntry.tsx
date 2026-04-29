'use client'

import { ArrowRight, RotateCcw } from 'lucide-react'
import type { CellHistoryEntry } from '@/features/cell-history/services/historyService'

interface HistoryEntryProps {
  entry: CellHistoryEntry
  onRestore: (historyId: string) => void
  isRestoring: boolean
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Unknown time'

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`

  const diffYears = Math.floor(diffMonths / 12)
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
}

function formatValue(value: string | null): string {
  if (value === null || value === '') return 'Blank'
  return value
}

function userLabel(userId: string | null): string {
  if (!userId) return 'Unknown user'
  return `User ${userId.slice(0, 8)}`
}

function userInitial(userId: string | null): string {
  return userId?.slice(0, 1).toUpperCase() || '?'
}

export function HistoryEntry({ entry, isRestoring, onRestore }: HistoryEntryProps) {
  return (
    <li className="relative border-l border-zinc-200 pb-5 pl-4 last:pb-0">
      <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-blue-200 bg-blue-500" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <time
            dateTime={entry.changed_at}
            title={new Date(entry.changed_at).toLocaleString()}
            className="text-xs font-medium text-zinc-500"
          >
            {formatRelativeTime(entry.changed_at)}
          </time>

          <div className="mt-2 flex max-w-[236px] items-center gap-2 text-sm">
            <span className="min-w-0 truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-700">
              {formatValue(entry.old_value)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
            <span className="min-w-0 truncate rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-700">
              {formatValue(entry.new_value)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-[9px] text-zinc-700">
            {userInitial(entry.changed_by)}
          </span>
          <span className="truncate">{userLabel(entry.changed_by)}</span>
        </span>

        <button
          type="button"
          onClick={() => onRestore(entry.id)}
          disabled={isRestoring}
          className="flex shrink-0 items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Restore to this value
        </button>
      </div>
    </li>
  )
}
