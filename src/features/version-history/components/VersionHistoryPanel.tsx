'use client'

/**
 * VersionHistoryPanel
 * --------------------------------------------------------------------------
 * Right-side panel for browsing, creating, and restoring workbook snapshots.
 *
 * Backed by versionsApi (Supabase-first with localStorage fallback). This
 * consolidates the former LocalVersionHistoryPanel (localStorage) and the
 * former server-action–backed VersionHistoryPanel into a single component.
 *
 * T025 acceptance path:
 *   edit cells → Save snapshot → make more edits → Restore → grid reverts.
 */

import { useCallback, useEffect, useState } from 'react'
import { Clock, Edit2, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useVersionUiStore } from '@/features/version-history/store/versionUiStore'
import { useSheetStore } from '@/store/sheetStore'
import {
  deleteVersion,
  editVersionLabel,
  listVersions,
  restoreVersion,
  snapshotVersion,
  type VersionRecord,
} from '@/lib/versionsApi'

interface VersionHistoryPanelProps {
  workbookId: string
  /** Explicit open override (optional; falls back to versionUiStore). */
  open?: boolean
  /** Explicit close handler override (optional; falls back to versionUiStore). */
  onClose?: () => void
}

export function VersionHistoryPanel({
  workbookId,
  open: openProp,
  onClose: onCloseProp,
}: VersionHistoryPanelProps) {
  const storeIsOpen = useVersionUiStore((s) => s.isOpen)
  const storeClose = useVersionUiStore((s) => s.close)
  const open = openProp ?? storeIsOpen
  const onClose = onCloseProp ?? storeClose

  const { gridSheets, replaceGridSheets } = useSheetStore()

  const [versions, setVersions] = useState<VersionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [label, setLabel] = useState('')
  /** id of the version currently being renamed inline */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  const refreshList = useCallback(async () => {
    if (!workbookId) return
    setLoading(true)
    try {
      const list = await listVersions(workbookId)
      setVersions(list)
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [workbookId])

  useEffect(() => {
    if (open) {
      void refreshList()
    }
  }, [open, refreshList])

  if (!open) return null

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------

  async function takeSnapshot() {
    if (gridSheets.length === 0) {
      toast.error('Nothing to snapshot.')
      return
    }
    setLoading(true)
    try {
      await snapshotVersion(workbookId, gridSheets, label.trim() || undefined)
      setLabel('')
      toast.success('Snapshot saved.')
      await refreshList()
    } catch {
      toast.error('Failed to save snapshot.')
    } finally {
      setLoading(false)
    }
  }

  async function restore(v: VersionRecord) {
    if (
      !confirm(
        `Restore "${v.label}"? This replaces your current sheets — your current state will be saved as a new snapshot first.`
      )
    )
      return

    setLoading(true)
    try {
      // restoreVersion internally creates a pre-restore safety snapshot.
      const restored = await restoreVersion(workbookId, v.id, gridSheets)
      if (!restored) {
        toast.error('Could not load the snapshot. It may have been deleted.')
        return
      }
      replaceGridSheets(restored)
      toast.success(`Restored "${v.label}".`)
      await refreshList()
      onClose()
    } catch {
      toast.error('Restore failed.')
    } finally {
      setLoading(false)
    }
  }

  async function remove(v: VersionRecord) {
    if (!confirm(`Delete snapshot "${v.label}"?`)) return
    setLoading(true)
    try {
      await deleteVersion(workbookId, v.id)
      toast.success('Snapshot deleted.')
      await refreshList()
    } catch {
      toast.error('Delete failed.')
    } finally {
      setLoading(false)
    }
  }

  function startRename(v: VersionRecord) {
    setEditingId(v.id)
    setEditingLabel(v.label)
  }

  async function commitRename(v: VersionRecord) {
    setEditingId(null)
    if (!editingLabel.trim() || editingLabel.trim() === v.label) return
    try {
      await editVersionLabel(workbookId, v.id, editingLabel.trim())
      await refreshList()
    } catch {
      // silent — the list will show the old label on next refresh.
    }
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <aside className="fixed right-0 top-0 z-[200] flex h-full w-[340px] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Version history
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Save snapshot */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Save snapshot
        </label>
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void takeSnapshot()
            }}
            placeholder="Optional label e.g. 'Q1 close'"
            disabled={loading}
            className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => void takeSnapshot()}
            disabled={loading}
            className="flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading && versions.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[12px] text-zinc-400">
            Loading…
          </div>
        ) : versions.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
            No snapshots yet — click <strong className="ml-1">Save</strong> to create your first one.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {versions.map((v) => (
              <li key={v.id} className="px-4 py-3">
                {/* Label row */}
                {editingId === v.id ? (
                  <input
                    autoFocus
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => void commitRename(v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(v)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-[13px] font-medium outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="flex-1 truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                      {v.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => startRename(v)}
                      aria-label="Rename"
                      className="rounded p-0.5 text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Meta */}
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>{new Date(v.createdAt).toLocaleString()}</span>
                  {v.source === 'local' && (
                    <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-700">local</span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => void restore(v)}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(v)}
                    disabled={loading}
                    aria-label="Delete snapshot"
                    className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30"
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
