'use client'

/**
 * FromWebDialog — Data > Get & Transform Data > From Web.
 *
 * Paste a URL pointing to a CSV or JSON resource. We hit
 * /api/data/fetch (server-side proxy, avoids CORS), parse the body
 * via parseFetchedTable, then pasteParsedTable drops it into the
 * active sheet starting at the selected cell.
 *
 * Excel's flow has way more knobs (auth, query editor, refresh
 * schedules). Quiksheets ships the 80% case: enter URL, click Fetch,
 * see a preview, confirm insert.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Download, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useFromWebDialogStore } from '../store/fromWebDialogStore'
import { parseFetchedTable, type ParsedTable } from '../utils/fromWebParser'
import { pasteParsedTable } from '../utils/pasteParsedTable'
import { colIndexToLetter } from '@/lib/cellAddress'
import { useSheetStore } from '@/store/sheetStore'

type DialogState =
  | { phase: 'idle' }
  | { phase: 'fetching' }
  | { phase: 'preview'; parsed: ParsedTable; sourceUrl: string }
  | { phase: 'error'; message: string }

const SAMPLES: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'JSON sample (REST users)',  url: 'https://jsonplaceholder.typicode.com/users' },
  { label: 'CSV sample (UN regions)',    url: 'https://gist.githubusercontent.com/rgrove/5cb4c8af1f33b7ce71a6/raw/f3a2c4cfcbf0e6d1b8cbe2c8b66c6e0c8e9b9d50/un-regions.csv' },
]

export function FromWebDialog() {
  const open = useFromWebDialogStore((s) => s.open)
  const close = useFromWebDialogStore((s) => s.closeDialog)
  const [url, setUrl] = useState('')
  const [state, setState] = useState<DialogState>({ phase: 'idle' })

  async function fetchAndPreview() {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Paste a URL first.')
      return
    }
    setState({ phase: 'fetching' })
    try {
      const res = await fetch('/api/data/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const json = await res.json() as { text?: string; contentType?: string; error?: string }
      if (!res.ok || !json.text) {
        setState({ phase: 'error', message: json.error ?? `Request failed with ${res.status}` })
        return
      }
      const parsed = parseFetchedTable(json.text, json.contentType ?? '')
      if (parsed.rowCount === 0) {
        setState({ phase: 'error', message: 'The response was empty or had no data rows.' })
        return
      }
      setState({ phase: 'preview', parsed, sourceUrl: trimmed })
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'unknown error' })
    }
  }

  function confirmInsert() {
    if (state.phase !== 'preview') return
    const result = pasteParsedTable(state.parsed.rows)
    if (!result) {
      toast.error('Could not paste — no active sheet.')
      return
    }
    const anchor = `${colIndexToLetter(result.anchorCol)}${result.anchorRow + 1}`
    toast.success(`Inserted ${result.rowsPasted} rows × ${result.colsPasted} cols at ${anchor}`)
    close()
    // Reset for next open
    setUrl('')
    setState({ phase: 'idle' })
  }

  function reset() {
    setUrl('')
    setState({ phase: 'idle' })
  }

  // Read the active selection for the preview hint
  const sel = useSheetStore((s) => s.selectedCell)
  const anchorLabel = sel ? `${colIndexToLetter(sel.col)}${sel.row + 1}` : 'A1'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { close(); reset() } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Get Data from Web</DialogTitle>
          <DialogDescription>
            Paste a URL pointing to a CSV or JSON file. We&apos;ll fetch it
            server-side (CORS-safe), parse it, and insert the rows
            starting at <code className="font-mono">{anchorLabel}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-1">
          {/* URL input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/data.csv"
              className="h-9 flex-1 rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              disabled={state.phase === 'fetching'}
            />
            <button
              type="button"
              onClick={fetchAndPreview}
              disabled={state.phase === 'fetching' || !url.trim()}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.phase === 'fetching' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Fetch
            </button>
          </div>

          {/* Sample URLs */}
          {state.phase === 'idle' && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-zinc-500">Try:</span>
              {SAMPLES.map((s) => (
                <button
                  key={s.url}
                  type="button"
                  onClick={() => setUrl(s.url)}
                  className="rounded border border-zinc-200 px-1.5 py-0.5 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
                >
                  <Globe className="mr-1 inline h-2.5 w-2.5" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Error state */}
          {state.phase === 'error' && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {state.message}
            </div>
          )}

          {/* Preview */}
          {state.phase === 'preview' && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                <span>
                  <strong className="font-semibold">{state.parsed.rowCount}</strong> rows ×{' '}
                  <strong className="font-semibold">{state.parsed.colCount}</strong> cols
                  &nbsp;·&nbsp;
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                    {state.parsed.format}
                  </span>
                </span>
                <span className="truncate font-mono text-[10px] text-zinc-500" title={state.sourceUrl}>
                  {state.sourceUrl}
                </span>
              </div>
              <div className="max-h-64 overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-[11px]">
                  <thead className="bg-zinc-100 dark:bg-zinc-800">
                    <tr>
                      {(state.parsed.rows[0] ?? []).map((cell, idx) => (
                        <th key={idx} className="border-r border-zinc-200 px-2 py-1 text-left font-semibold last:border-r-0 dark:border-zinc-700">
                          {cell === null ? '' : String(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.parsed.rows.slice(1, 11).map((row, ri) => (
                      <tr key={ri} className="even:bg-zinc-50 dark:even:bg-zinc-800/50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="border-r border-t border-zinc-100 px-2 py-1 last:border-r-0 dark:border-zinc-800">
                            {cell === null ? <span className="text-zinc-400">∅</span> : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {state.parsed.rowCount > 11 && (
                  <div className="bg-zinc-50 px-2 py-1 text-center text-[10px] italic text-zinc-500 dark:bg-zinc-800/50">
                    … and {state.parsed.rowCount - 11} more rows
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-1">
          <button
            type="button"
            onClick={() => { close(); reset() }}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          {state.phase === 'preview' && (
            <button
              type="button"
              onClick={confirmInsert}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Insert {state.parsed.rowCount} rows
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
