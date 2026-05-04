'use client'

/**
 * LocalVersionHistoryPanel
 * --------------------------------------------------------------------------
 * Right-side panel that snapshots and restores the *entire* workbook
 * (gridSheets[]) using localStorage.  Unlike the Supabase-backed twin, this
 * one performs a *real* restore — the snapshot is pushed back into the
 * sheetStore via replaceGridSheets.
 *
 * Two ways to create snapshots:
 *   • "Save snapshot" button — manual labelled snapshot
 *   • Auto-snapshot — see useAutoSnapshot in this folder (called from page.tsx)
 */

import { useMemo, useState } from 'react'
import { Clock, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useVersionUiStore } from '@/features/version-history/store/versionUiStore'
import {
  deleteVersion,
  listWorkbookVersions,
  snapshotWorkbook,
  type StoredVersion,
} from '@/features/version-history/storage/localVersionStore'
import { useSheetStore } from '@/store/sheetStore'

export function LocalVersionHistoryPanel({ workbookId }: { workbookId: string }) {
  const open = useVersionUiStore((s) => s.isOpen)
  const close = useVersionUiStore((s) => s.close)
  const version = useVersionUiStore((s) => s.version)
  const bump = useVersionUiStore((s) => s.bump)
  const { gridSheets, replaceGridSheets } = useSheetStore()

  const [label, setLabel] = useState('')

  const versions = useMemo<StoredVersion[]>(() => {
    void version
    return listWorkbookVersions(workbookId)
  }, [workbookId, version])

  if (!open) return null

  function takeSnapshot() {
    if (gridSheets.length === 0) {
      toast.error('Nothing to snapshot.')
      return
    }
    snapshotWorkbook(workbookId, gridSheets, label.trim() || undefined)
    setLabel('')
    bump()
    toast.success('Snapshot saved.')
  }

  function restore(v: StoredVersion) {
    if (!confirm(`Restore "${v.label}"?  This replaces your current sheets — current state will be saved as a new snapshot first.`)) return
    // pre-restore safety snapshot
    snapshotWorkbook(workbookId, gridSheets, 'Auto-saved before restore')
    replaceGridSheets(v.snapshot)
    bump()
    toast.success(`Restored "${v.label}".`)
  }

  function remove(v: StoredVersion) {
    if (!confirm(`Delete snapshot "${v.label}"?`)) return
    deleteVersion(workbookId, v.id)
    bump()
    toast.success('Snapshot deleted.')
  }

  return (
    <aside className="fixed right-0 top-0 z-[200] flex h-full w-[340px] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Version history</h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Save snapshot
        </label>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') takeSnapshot() }}
            placeholder="Optional label e.g. 'Q1 close'"
            className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={takeSnapshot}
            className="flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
            No snapshots yet — click <strong>Save</strong> to create your first one.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {versions.map((v) => (
              <li key={v.id} className="px-4 py-3">
                <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                  {v.label}
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                  {new Date(v.createdAt).toLocaleString()} · {v.snapshot.length} sheet{v.snapshot.length === 1 ? '' : 's'}
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => restore(v)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    aria-label="Delete snapshot"
                    className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
