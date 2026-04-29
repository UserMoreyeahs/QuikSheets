'use client'

import { useEffect, useState, useTransition } from 'react'
import { Clock, RotateCcw } from 'lucide-react'
import {
  listWorkbookVersionsAction,
  restoreWorkbookVersionAction,
  type WorkbookVersion,
} from '../actions'

interface VersionHistoryPanelProps {
  workbookId: string
  open: boolean
  onClose: () => void
}

export function VersionHistoryPanel({ workbookId, open, onClose }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<WorkbookVersion[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listWorkbookVersionsAction(workbookId).then(setVersions).catch(() => setVersions([]))
  }, [open, workbookId])

  if (!open) return null

  return (
    <aside className="fixed right-0 top-0 z-[200] flex h-full w-[320px] flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Version history</h2>
        </div>
        <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          Close
        </button>
      </header>

      {error ? <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No saved versions yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {versions.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {v.label ?? 'Snapshot'}
                  </p>
                  <p className="text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null)
                    startTransition(async () => {
                      const result = await restoreWorkbookVersionAction({
                        workbookId,
                        versionId: v.id,
                      })
                      if (!result.ok) setError(result.error ?? 'Restore failed')
                    })
                  }}
                  className="flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
