'use client'

/**
 * CommentComposer
 * --------------------------------------------------------------------------
 * Small floating popover that appears centered when the user picks
 * "Add comment" — captures a body with @mention support, then writes it to
 * localStorage and bumps the comments-version so the panel re-reads.
 */

import { useEffect, useState } from 'react'
import { X, AtSign, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useCommentsUiStore } from '@/features/comments/store/commentsUiStore'
import { addComment } from '@/features/comments/storage/localCommentsStore'
import { useWorkbookStore } from '@/store/workbookStore'

export function CommentComposer({ workbookId }: { workbookId: string }) {
  const composer = useCommentsUiStore((s) => s.composer)
  const closeComposer = useCommentsUiStore((s) => s.closeComposer)
  const openPanel = useCommentsUiStore((s) => s.openPanel)
  const bump = useCommentsUiStore((s) => s.bump)
  const { sheets } = useWorkbookStore()

  const [body, setBody] = useState('')
  useEffect(() => {
    if (composer) setBody('')
  }, [composer])

  if (!composer) return null

  const sheetName = sheets.find((s) => s.id === composer.sheetId)?.name ?? composer.sheetId

  function submit() {
    if (!composer) return
    const trimmed = body.trim()
    if (!trimmed) {
      toast.error('Type something first.')
      return
    }
    addComment({
      workbookId,
      sheetId: composer.sheetId,
      cellAddress: composer.cellAddress,
      body: trimmed,
      author: 'You',
    })
    bump()
    toast.success(`Comment added on ${composer.cellAddress}`)
    closeComposer()
    openPanel()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
              Add comment
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {sheetName} · {composer.cellAddress}
            </span>
          </div>
          <button
            type="button"
            onClick={closeComposer}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                submit()
              } else if (e.key === 'Escape') {
                closeComposer()
              }
            }}
            placeholder='Add a comment. Mention teammates with @name (e.g. "@priya please review")'
            autoFocus
            rows={4}
            className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Mention with <kbd className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">@</kbd>
            </span>
            <span><kbd className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">⌘</kbd>+<kbd className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">Enter</kbd> to send</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
          <button
            type="button"
            onClick={closeComposer}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim()}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            Add comment
          </button>
        </div>
      </div>
    </div>
  )
}
