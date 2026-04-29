'use client'

import { Copy, Download, FilePlus2, Sparkles, X } from 'lucide-react'
import type { ColumnStats } from '../utils/rowStats'

interface RowSummarizerProps {
  error: string | null
  insights: string[]
  isLoading: boolean
  isOpen: boolean
  rowCount: number
  stats: ColumnStats[]
  summary: string
  onClose: () => void
  onCopy: () => void
  onExport: () => void
  onInsertBelow: () => void
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function describeStat(stat: ColumnStats): string {
  if (stat.type === 'number') {
    return `sum ${formatNumber(stat.sum)}, avg ${formatNumber(stat.average)}, min ${formatNumber(stat.min)}, max ${formatNumber(stat.max)}`
  }

  if (stat.type === 'date' && stat.dateMin && stat.dateMax) {
    return `date range ${stat.dateMin} to ${stat.dateMax}`
  }

  if (stat.type === 'text') {
    const common = stat.mostCommonValue
      ? `, most common "${stat.mostCommonValue}" (${stat.mostCommonCount ?? 1})`
      : ''
    return `${stat.uniqueCount ?? 0} unique values${common}`
  }

  if (stat.type === 'mixed') {
    return `${stat.filledCount} filled values with mixed types`
  }

  return 'empty column'
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-4">
      <div className="h-4 w-11/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-9/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-10/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  )
}

export function RowSummarizer({
  error,
  insights,
  isLoading,
  isOpen,
  rowCount,
  stats,
  summary,
  onClose,
  onCopy,
  onExport,
  onInsertBelow,
}: RowSummarizerProps) {
  if (!isOpen) return null

  const visibleStats = stats
    .filter((stat) => stat.filledCount > 0 || stat.emptyCount > 0)
    .slice(0, 8)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4">
      <section className="w-full max-w-[480px] rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                AI Row Summary
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Summarizing {rowCount} rows
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            aria-label="Close row summary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Summary
                </h3>
                <p className="text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-50">
                  {summary || 'No summary was generated for this selection.'}
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Key Stats
                </h3>
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">Total rows</span>
                    <span className="text-zinc-600 dark:text-zinc-300">{rowCount}</span>
                  </div>
                  {visibleStats.map((stat) => (
                    <div
                      key={`${stat.columnIndex}-${stat.header}`}
                      className="border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-700/70"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          {stat.header}
                        </span>
                        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
                          {stat.type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {describeStat(stat)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  AI Insights
                </h3>
                <ul className="space-y-2">
                  {insights.map((insight, index) => (
                    <li
                      key={`${index}-${insight}`}
                      className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                    >
                      {insight}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={onCopy}
            disabled={isLoading || !summary}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy summary
          </button>
          <button
            type="button"
            onClick={onInsertBelow}
            disabled={isLoading || !summary}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            Insert below selection
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={isLoading || !summary}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export as report
          </button>
        </footer>
      </section>
    </div>
  )
}
