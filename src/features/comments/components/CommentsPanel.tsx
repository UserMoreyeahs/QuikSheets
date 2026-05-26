'use client'

/**
 * CommentsPanel
 * --------------------------------------------------------------------------
 * Right-side slide-in panel listing every comment for the active workbook,
 * grouped by sheet + cell.  Each comment supports resolve / unresolve and
 * delete; clicking a header pings the user back to that cell (visual only).
 *
 * Data path: src/lib/commentsApi.ts — Supabase when signed in, localStorage
 * fallback otherwise. The panel re-fetches whenever `commentsUiStore.version`
 * bumps (mutations call bump() so the list refreshes).
 */

import { useEffect, useMemo, useState } from 'react'
import { X, MessageSquare, CheckCircle2, RotateCcw, Trash2, AtSign } from 'lucide-react'
import { toast } from 'sonner'
import { useCommentsUiStore } from '@/features/comments/store/commentsUiStore'
import {
  loadComments,
  resolveComment,
  deleteComment,
  type CommentRecord,
} from '@/lib/commentsApi'
import { useWorkbookStore } from '@/store/workbookStore'
import { useSheetStore } from '@/store/sheetStore'
import { cn } from '@/lib/utils'

export function CommentsPanel({ workbookId }: { workbookId: string }) {
  const open = useCommentsUiStore((s) => s.panelOpen)
  const closePanel = useCommentsUiStore((s) => s.closePanel)
  const version = useCommentsUiStore((s) => s.version)
  const bump = useCommentsUiStore((s) => s.bump)
  const { sheets, activeSheetId, setActiveSheet } = useWorkbookStore()
  const setSelectedCell = useSheetStore((s) => s.setSelectedCell)

  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [all, setAll] = useState<CommentRecord[]>([])

  // Fetch whenever the panel opens, the workbook switches, or a mutation
  // bumps the version. Skipping the fetch while closed keeps the auth
  // round-trip off the main paint.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadComments(workbookId).then((list) => {
      if (!cancelled) setAll(list)
    })
    return () => {
      cancelled = true
    }
  }, [open, workbookId, version])

  const filtered = useMemo(
    () =>
      all.filter((c) =>
        filter === 'all' ? true : filter === 'open' ? !c.resolved : c.resolved
      ),
    [all, filter]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, CommentRecord[]>()
    for (const c of filtered) {
      const key = `${c.sheetId}::${c.cellAddress}`
      const list = map.get(key)
      if (list) list.push(c)
      else map.set(key, [c])
    }
    return Array.from(map.entries())
  }, [filtered])

  if (!open) return null

  function jumpTo(c: CommentRecord) {
    // best-effort: parse "B3" → row/col, switch sheet if needed, then select.
    const m = c.cellAddress.match(/^([A-Z]+)(\d+)$/)
    if (!m) return
    const colLetters = m[1]!
    const rowNum = Number(m[2])
    let col = 0
    for (let i = 0; i < colLetters.length; i++) col = col * 26 + (colLetters.charCodeAt(i) - 64)
    col -= 1
    const sheetIdx = sheets.findIndex((s) => s.id === c.sheetId)
    if (sheetIdx < 0) return
    if (c.sheetId !== activeSheetId) setActiveSheet(c.sheetId)
    setSelectedCell({ row: rowNum - 1, col, sheet: sheetIdx })
  }

  async function handleResolveToggle(c: CommentRecord) {
    // Optimistic update so the toggle feels instant.
    setAll((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, resolved: !c.resolved } : x))
    )
    try {
      await resolveComment(workbookId, c.id, !c.resolved)
    } catch (err) {
      toast.error('Could not update comment.')
      // revert
      setAll((prev) => prev.map((x) => (x.id === c.id ? { ...x, resolved: c.resolved } : x)))
      // eslint-disable-next-line no-console
      console.debug('[CommentsPanel] resolve failed:', err)
    }
    bump()
  }

  async function handleDelete(c: CommentRecord) {
    if (!confirm('Delete this comment?')) return
    // Optimistic remove.
    setAll((prev) => prev.filter((x) => x.id !== c.id))
    try {
      await deleteComment(workbookId, c.id)
      toast.success('Comment deleted.')
    } catch (err) {
      toast.error('Could not delete comment.')
      // eslint-disable-next-line no-console
      console.debug('[CommentsPanel] delete failed:', err)
    }
    bump()
  }

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-[340px] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Comments</span>
        </div>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Close comments"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
        {(['open', 'resolved', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors',
              filter === value
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            {value} {value !== 'all' && (
              <span className="ml-1 rounded-full bg-white px-1.5 text-[10px] dark:bg-zinc-700">
                {all.filter((c) => (value === 'open' ? !c.resolved : c.resolved)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
            {filter === 'open'
              ? 'No open comments.  Right-click a cell → Add comment to start a thread.'
              : filter === 'resolved'
                ? 'No resolved comments yet.'
                : 'No comments in this workbook yet.'}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {grouped.map(([key, comments]) => {
              const first = comments[0]!
              const sheetName = sheets.find((s) => s.id === first.sheetId)?.name ?? first.sheetId
              return (
                <li key={key} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => jumpTo(first)}
                    className="flex w-full items-baseline gap-2 text-left"
                  >
                    <span className="font-mono text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      {first.cellAddress}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">on {sheetName}</span>
                  </button>
                  <div className="mt-1.5 space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className={cn('rounded-md border px-2.5 py-2', c.resolved ? 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-700 dark:bg-zinc-800/50' : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900')}>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-200">{c.author}</span>
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                        <p className={cn('mt-1 text-[12px] leading-snug text-zinc-700 dark:text-zinc-200', c.resolved && 'line-through')}>
                          {renderBodyWithMentions(c.body)}
                        </p>
                        {c.mentions.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.mentions.map((m) => (
                              <span key={m} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <AtSign className="h-2.5 w-2.5" />{m}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => void handleResolveToggle(c)}
                            aria-label={c.resolved ? 'Reopen' : 'Resolve'}
                            title={c.resolved ? 'Reopen' : 'Resolve'}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            {c.resolved ? <RotateCcw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(c)}
                            aria-label="Delete"
                            title="Delete"
                            className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

function renderBodyWithMentions(body: string) {
  const parts = body.split(/(@[A-Za-z0-9_.-]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="font-medium text-blue-600 dark:text-blue-400">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}
