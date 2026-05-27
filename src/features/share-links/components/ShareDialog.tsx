'use client'

/**
 * ShareDialog
 * --------------------------------------------------------------------------
 * Modal that lets the workbook owner generate, copy, and revoke share links.
 *
 * Storage strategy (Supabase-first):
 *   1. If the workbookId is a valid UUID → call server actions (createShareLinkAction,
 *      listShareLinksAction, revokeShareLinkAction) which write to/read from Supabase.
 *      On Supabase success the local copy is also updated so the list is never stale
 *      while the server-action revalidation is in flight.
 *   2. If Supabase is not configured / user lacks manage permission → fall back to
 *      localStorage only (standalone / unauthenticated mode).
 *
 * The /s/[token] route resolves tokens via the service-role Supabase client first,
 * then falls back to localStorage (LocalShareTokenResolver) for standalone links.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Copy, ExternalLink, Link2, Lock, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useShareDialogStore } from '@/features/share-links/store/shareDialogStore'
import {
  createShareLinkAction,
  listShareLinksAction,
  revokeShareLinkAction,
  type ShareLinkRow,
} from '@/features/share-links/actions'
import {
  createLocalShareLink,
  listLocalShareLinks,
  revokeLocalShareLink,
  type LocalShareLink,
} from '@/features/share-links/storage/localShareLinks'
import { cn } from '@/lib/utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Role = 'viewer' | 'editor'
type ExpiryOption = 'never' | '1d' | '7d' | '30d'

const EXPIRY_LABELS: Record<ExpiryOption, string> = {
  never: 'No expiry',
  '1d': '1 day',
  '7d': '7 days',
  '30d': '30 days',
}

function expiryToTimestamp(option: ExpiryOption): number | null {
  if (option === 'never') return null
  const days = option === '1d' ? 1 : option === '7d' ? 7 : 30
  return Date.now() + days * 24 * 60 * 60 * 1000
}

function buildShareUrl(token: string): string {
  if (typeof window === 'undefined') return `/s/${token}`
  return `${window.location.origin}/s/${token}`
}

// ─── Unified display type (covers both Supabase rows and local links) ─────────

interface DisplayLink {
  id: string
  token: string
  role: Role
  expiresAt: number | null   // ms epoch
  active: boolean
  createdAt: number          // ms epoch
  source: 'supabase' | 'local'
}

function supabaseRowToDisplay(row: ShareLinkRow): DisplayLink {
  return {
    id: row.id,
    token: row.token,
    role: row.role,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null,
    active: row.active,
    createdAt: new Date(row.createdAt).getTime(),
    source: 'supabase',
  }
}

function localLinkToDisplay(l: LocalShareLink): DisplayLink {
  return {
    id: l.token,
    token: l.token,
    role: l.role,
    expiresAt: l.expiresAt,
    active: l.active,
    createdAt: l.createdAt,
    source: 'local',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareDialog({
  workbookId,
  workbookName,
}: {
  workbookId: string
  workbookName: string
}) {
  const open = useShareDialogStore((s) => s.isOpen)
  const close = useShareDialogStore((s) => s.close)

  const [role, setRole] = useState<Role>('viewer')
  const [expiry, setExpiry] = useState<ExpiryOption>('7d')
  const [pending, startTransition] = useTransition()
  const [links, setLinks] = useState<DisplayLink[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const isUuid = useMemo(() => UUID_RE.test(workbookId), [workbookId])

  // ── Load links ─────────────────────────────────────────────────────────────

  const loadLinks = useCallback(async () => {
    if (!isUuid) {
      // Standalone mode — only localStorage
      setLinks(listLocalShareLinks(workbookId).map(localLinkToDisplay))
      return
    }
    setLoading(true)
    try {
      const result = await listShareLinksAction(workbookId)
      if (result.ok) {
        setLinks(result.links.map(supabaseRowToDisplay))
        return
      }
      // Fallback: Supabase failed (e.g. Forbidden when not the owner) — show local
      setLinks(listLocalShareLinks(workbookId).map(localLinkToDisplay))
    } catch {
      setLinks(listLocalShareLinks(workbookId).map(localLinkToDisplay))
    } finally {
      setLoading(false)
    }
  }, [isUuid, workbookId])

  useEffect(() => {
    if (!open) return
    void loadLinks()
  }, [open, loadLinks, refreshKey])

  if (!open) return null

  function refresh() {
    setRefreshKey((n) => n + 1)
  }

  // ── Create link ────────────────────────────────────────────────────────────

  function createLink() {
    startTransition(async () => {
      const expiresAt = expiryToTimestamp(expiry)
      const expiresAtIso = expiresAt ? new Date(expiresAt).toISOString() : undefined

      if (isUuid) {
        const result = await createShareLinkAction({
          workbookId,
          role,
          ...(expiresAtIso ? { expiresAt: expiresAtIso } : {}),
        })
        if (result.ok && result.token) {
          // Mirror into localStorage so the fallback path also works
          createLocalShareLink({ workbookId, role, expiresAt })
          toast.success('Share link created.')
          refresh()
          return
        }
        if (
          result.error &&
          result.error !== 'Forbidden' &&
          result.error !== 'Supabase not configured'
        ) {
          toast.error(result.error)
          return
        }
        // Forbidden / not-configured → fall through to local
      }

      // localStorage fallback (standalone or Supabase unavailable)
      createLocalShareLink({ workbookId, role, expiresAt })
      toast.success('Share link created (local only).')
      refresh()
    })
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────

  function revoke(link: DisplayLink) {
    if (!confirm('Revoke this link? Anyone using it will lose access immediately.')) return
    startTransition(async () => {
      if (isUuid && link.source === 'supabase') {
        const result = await revokeShareLinkAction({
          workbookId,
          token: link.token,
        })
        if (!result.ok) {
          toast.error(result.error ?? 'Failed to revoke link.')
          return
        }
      }
      // Always revoke locally too (keeps local index consistent)
      revokeLocalShareLink(workbookId, link.token)
      toast.success('Link revoked.')
      refresh()
    })
  }

  // ── Copy ───────────────────────────────────────────────────────────────────

  function copyLink(link: DisplayLink) {
    const url = buildShareUrl(link.token)
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied.'),
      () => toast.error('Could not copy.')
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Share workbook
            </h2>
            <span className="truncate text-[12px] text-zinc-500">— {workbookName}</span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Create new link */}
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            New share link
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value as ExpiryOption)}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {(Object.keys(EXPIRY_LABELS) as ExpiryOption[]).map((opt) => (
                <option key={opt} value={opt}>
                  {EXPIRY_LABELS[opt]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createLink}
              disabled={pending}
              className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Creating…' : 'Create link'}
            </button>
          </div>
          {!isUuid && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-3 w-3" />
              Standalone mode — link is saved locally and resolved by the same browser.
            </p>
          )}
        </div>

        {/* Link list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Share links
            </span>
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh"
              disabled={loading}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            </button>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-[12px] text-zinc-400">
              Loading…
            </div>
          ) : links.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-300 text-[12px] text-zinc-400 dark:border-zinc-700">
              No share links yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => {
                const expired = link.expiresAt !== null && link.expiresAt < Date.now()
                const inactive = !link.active || expired
                const url = buildShareUrl(link.token)
                return (
                  <li
                    key={link.id}
                    className={cn(
                      'rounded-md border px-3 py-2',
                      inactive
                        ? 'border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-700 dark:bg-zinc-800/40'
                        : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          link.role === 'editor'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                        )}
                      >
                        {link.role}
                      </span>
                      <code className="flex-1 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
                        {url}
                      </code>
                      {!inactive && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyLink(link)}
                            aria-label="Copy link"
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open link"
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => revoke(link)}
                            aria-label="Revoke link"
                            className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {inactive && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          <Lock className="h-3 w-3" />
                          {expired ? 'Expired' : 'Revoked'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      Created {new Date(link.createdAt).toLocaleString()}
                      {link.expiresAt !== null && (
                        <> · Expires {new Date(link.expiresAt).toLocaleString()}</>
                      )}
                      {link.source === 'local' && (
                        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          local
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
