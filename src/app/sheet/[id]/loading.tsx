import { FileSpreadsheet } from 'lucide-react'

/**
 * Shown while Next.js compiles `/sheet/[id]` (slow on first dev visit because
 * the route includes FortuneSheet + ReactFlow + ECharts + every AI panel) or
 * while the server component fetches workbook data.
 *
 * In production builds the compile is already done and this component flashes
 * for only as long as the network round-trip takes.
 */
export default function SheetLoading() {
  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 animate-pulse text-blue-600" aria-hidden="true" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Quiksheets</span>
          <span className="ml-2 text-xs text-zinc-500">Opening workbook…</span>
        </div>
      </header>

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-7 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>

      {/* Formula bar skeleton */}
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-6 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-6 flex-1 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
      </div>

      {/* Grid skeleton */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="grid grid-cols-13 gap-px bg-zinc-200 dark:bg-zinc-800">
          {Array.from({ length: 13 * 18 }).map((_, i) => (
            <div
              key={i}
              className="h-7 animate-pulse bg-white dark:bg-zinc-900"
              style={{ animationDelay: `${(i % 13) * 30}ms` }}
            />
          ))}
        </div>
      </div>

      <p className="border-t border-zinc-200 bg-white px-4 py-2 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        First load is slow in dev mode (compiling ~3,800 modules). Subsequent loads are instant.
      </p>
    </div>
  )
}
