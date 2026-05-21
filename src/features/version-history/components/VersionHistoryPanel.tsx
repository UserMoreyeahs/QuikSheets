'use client'

import { useEffect, useState, useTransition } from 'react'
import { Clock, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  listWorkbookVersionsAction,
  restoreWorkbookVersionAction,
  snapshotWorkbookAction,
  type WorkbookVersion,
} from '../actions'
import { useVersionUiStore } from '../store/versionUiStore'
import { useSheetStore } from '@/store/sheetStore'
import { cloneSheetWithData, getSheetMatrix } from '@/lib/fortuneSheet'
import type { Cell, Sheet } from '@fortune-sheet/core'

interface VersionHistoryPanelProps {
  workbookId: string
  /** When supplied, overrides the global `versionUiStore.isOpen`. */
  open?: boolean
  /** When supplied, overrides `versionUiStore.close()`. */
  onClose?: () => void
}

/**
 * Server-backed snapshot shape.
 *
 * The legacy localStorage panel used `{ sheets: Sheet[] }` directly;
 * the server snapshot uses the same shape for symmetry. When restoring
 * a snapshot taken before this format existed, we fall back to no-op.
 */
interface ServerSnapshot {
  sheets?: Sheet[]
  cells?: unknown[]
}

export function VersionHistoryPanel({ workbookId, open: openProp, onClose: onCloseProp }: VersionHistoryPanelProps) {
  // The panel can be driven either from a global store (Ribbon "Version
  // history" toggle) OR from explicit props (one-off callers).
  const storeIsOpen = useVersionUiStore((s) => s.isOpen)
  const storeClose = useVersionUiStore((s) => s.close)
  const open = openProp ?? storeIsOpen
  const onClose = onCloseProp ?? storeClose

  const [versions, setVersions] = useState<WorkbookVersion[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listWorkbookVersionsAction(workbookId).then(setVersions).catch(() => setVersions([]))
  }, [open, workbookId])

  /**
   * Capture the current gridSheets into a server snapshot row.
   * The "Save snapshot now" button uses this to take an explicit
   * checkpoint outside the auto-snapshot cadence.
   */
  function captureNow() {
    const { gridSheets } = useSheetStore.getState()
    startTransition(async () => {
      const result = await snapshotWorkbookAction({
        workbookId,
        label: `Manual ${new Date().toLocaleString()}`,
        snapshot: { sheets: gridSheets } satisfies ServerSnapshot,
      })
      if (!result.ok) {
        setError(result.error ?? 'Snapshot failed')
        return
      }
      const refreshed = await listWorkbookVersionsAction(workbookId).catch(() => [])
      setVersions(refreshed)
      toast.success('Version saved')
    })
  }

  if (!open) return null

  return (
    <aside className="fixed right-0 top-0 z-[200] flex h-full w-[320px] flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Version history</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={captureNow}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Save now
          </button>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
            Close
          </button>
        </div>
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
                      if (!result.ok) {
                        setError(result.error ?? 'Restore failed')
                        return
                      }
                      // Apply the snapshot to the live grid. The server
                      // already wrote a pre-restore checkpoint so this
                      // operation is itself reversible.
                      applyServerSnapshot(result.snapshot)
                      toast.success('Workbook restored from snapshot')
                      onClose()
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

/**
 * Apply a server snapshot to the live grid.
 *
 * - For new-format snapshots (`{ sheets: Sheet[] }`) we replace the
 *   gridSheets directly. The normal debounced save pipeline will then
 *   write the restored cells back to Supabase, making the DB and the
 *   client converge again.
 * - For legacy snapshots (`{ cells: [...] }`) we no-op visually but
 *   still surface a warning toast — the cells will have been replayed
 *   server-side via the audit-log row.
 */
function applyServerSnapshot(raw: unknown): void {
  if (!raw || typeof raw !== 'object') {
    toast.warning('Snapshot was empty; nothing to restore.')
    return
  }
  const snap = raw as ServerSnapshot
  if (Array.isArray(snap.sheets) && snap.sheets.length > 0) {
    // Defensive clone so the store's gridSheets reference identity
    // changes (triggers a React re-render) and we don't share mutable
    // state with the snapshot row.
    const cloned = snap.sheets.map((s) => cloneSheetWithData(s, getSheetMatrix(s) as Cell[][]))
    useSheetStore.getState().replaceGridSheets(cloned)
    return
  }
  // Legacy or unrecognised payload — caller already wrote an audit row.
  toast.warning('Snapshot format not supported on this build — open the workbook in latest to apply.')
}
