'use client'

/**
 * useRealtimeCollab
 * -----------------
 * Wires Supabase Realtime for multi-user co-editing:
 *
 *   1. Shares a single Realtime channel via useWorkbookChannel (channel dedup).
 *   2. Broadcasts local cell selection changes → other users see cursors.
 *   3. Broadcasts cell edits → other users receive updated cell data.
 *   4. Tracks remote presence (who's here, what they're looking at).
 *
 * Graceful fallback: when Supabase is not configured, the hook is a no-op —
 * the app works in single-user mode with no errors.
 *
 * Channel sharing
 * ---------------
 * All three collab hooks (useRealtimeCollab, useBroadcast, usePresence) share
 * ONE Supabase Realtime channel per workbook via useWorkbookChannel.  Events
 * are differentiated by the Broadcast `event` field:
 *   'cell_edit'      — remote cell mutations
 *   'cursor'         — cursor/selection position
 *   'presence-update'— presence list (handled by usePresence)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { usePresenceStore } from '../store/presenceStore'
import { useSheetStore } from '@/store/sheetStore'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import { useWorkbookChannel } from './useWorkbookChannel'

interface CellEditPayload {
  type: 'cell_edit'
  userId: string
  sheetId: string
  row: number
  col: number
  value: string | number | null
  display: string
}

interface CursorPayload {
  type: 'cursor'
  userId: string
  name: string
  email: string
  sheetId: string
  row: number
  col: number
}

export function useRealtimeCollab(workbookId: string) {
  const upsertPresence = usePresenceStore((s) => s.upsertPresence)
  const pruneStale = usePresenceStore((s) => s.pruneStale)

  // ── Shared channel (one per workbook, ref-counted) ─────────────
  const sharedChannel = useWorkbookChannel(workbookId)

  // Identity: ONLY the authenticated Supabase user id.
  //
  // Previous behaviour generated a per-session anon UUID and broadcast
  // with it before auth resolved.  Two consequences:
  //   1. A second tab from the same user (also pre-auth) received the
  //      anon-UUID broadcast and rendered it as a "remote user" — the
  //      ghost-presence chip the user reported.  Even after auth
  //      resolved on both tabs, the anon entries lingered in the
  //      presence Map for ~30s until pruneStale removed them.
  //   2. Supabase's broadcast `self: false` is keyed by client_id, which
  //      means anon-id sends in the brief pre-auth window could echo back
  //      to the same tab in some race conditions.
  //
  // The fix: never broadcast as anon.  Anonymous viewers don't get
  // cursor presence (which is fine — they're read-only anyway), and
  // authenticated users always identify with their stable auth id so
  // two tabs from the same user collapse to one presence entry.
  const [authUser, setAuthUser] = useState<{ id: string; email: string; name: string } | null>(null)
  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    void supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      if (!u) return
      const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string }
      setAuthUser({
        id: u.id,
        email: u.email ?? '',
        name: meta.full_name ?? meta.name ?? u.email?.split('@')[0] ?? `User ${u.id.slice(0, 4)}`,
      })
    })
  }, [])
  const userId = authUser?.id ?? null
  const userName = authUser?.name ?? ''
  const userEmail = authUser?.email ?? ''

  // ── Register broadcast listeners on the shared channel ────────
  // Use a ref for userId so the handlers always read the CURRENT id
  // (set after auth resolves) without needing to re-subscribe on every
  // auth change.  Re-subscribing previously leaked listeners because
  // sharedChannel.on() has no symmetric .off() in our cleanup.
  const userIdRef = useRef<string | null>(null)
  userIdRef.current = userId

  useEffect(() => {
    if (!sharedChannel) return

    const onCursor = ({ payload }: { payload: unknown }) => {
      const p = payload as CursorPayload
      // Skip self.  Also skip when we don't yet have an auth id — at
      // that point we can't reliably distinguish self from other and
      // the safer default is to drop the message.
      if (!userIdRef.current || p.userId === userIdRef.current) return
      upsertPresence({
        userId: p.userId,
        name: p.name || `User ${p.userId.slice(0, 4)}`,
        email: p.email || '',
        color: '', // assigned by the store
        row: p.row,
        col: p.col,
        sheetId: p.sheetId,
        lastSeen: Date.now(),
      })
    }

    const onCellEdit = ({ payload }: { payload: unknown }) => {
      const p = payload as CellEditPayload
      if (!userIdRef.current || p.userId === userIdRef.current) return
      applyRemoteEdit(p)
    }

    sharedChannel
      .on('broadcast', { event: 'cursor' }, onCursor)
      .on('broadcast', { event: 'cell_edit' }, onCellEdit)

    const pruneInterval = setInterval(() => pruneStale(), 15000)

    return () => {
      clearInterval(pruneInterval)
      // Note: channel teardown is managed by useWorkbookChannel.  The
      // .on() handlers above are tied to the channel's lifetime — when
      // the channel unsubscribes (last subscriber unmounts), all
      // listeners are dropped with it.  Re-running this effect on
      // sharedChannel change registers fresh handlers against the new
      // channel, which is the correct behaviour.
    }
  }, [sharedChannel, upsertPresence, pruneStale])

  // ── Broadcast local cursor ─────────────────────────────────────
  // Guard on authUser: don't broadcast cursor presence until we know
  // who the user is.  This avoids the ghost-presence race described
  // above.
  const broadcastCursor = useCallback(
    (sheetId: string, row: number, col: number) => {
      if (!sharedChannel || !userId) return
      void sharedChannel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: {
          type: 'cursor',
          userId,
          name: userName,
          email: userEmail,
          sheetId,
          row,
          col,
        } satisfies CursorPayload,
      })
    },
    [sharedChannel, userId, userName, userEmail],
  )

  // ── Broadcast cell edit ────────────────────────────────────────
  const broadcastEdit = useCallback(
    (sheetId: string, row: number, col: number, value: string | number | null, display: string) => {
      if (!sharedChannel || !userId) return
      void sharedChannel.send({
        type: 'broadcast',
        event: 'cell_edit',
        payload: {
          type: 'cell_edit',
          userId,
          sheetId,
          row,
          col,
          value,
          display,
        } satisfies CellEditPayload,
      })
    },
    [sharedChannel, userId],
  )

  return {
    userId: userId ?? '',
    broadcastCursor,
    broadcastEdit,
    isConnected: sharedChannel !== null,
  }
}

/**
 * Apply a remote cell edit to the local grid.
 * Writes into the `data` 2D array (what FortuneSheet renders),
 * NOT `celldata` (sparse init-only format).
 */
function applyRemoteEdit(edit: CellEditPayload) {
  const { gridSheets, replaceGridSheets } = useSheetStore.getState()
  const sheet = gridSheets.find((s) => s.id === edit.sheetId)
  if (!sheet) return

  try {
    const matrix = getSheetMatrix(sheet)
    const nextMatrix = matrix.map((row) => [...(row ?? [])])

    // Ensure the target row exists
    while (nextMatrix.length <= edit.row) {
      nextMatrix.push(Array.from({ length: nextMatrix[0]?.length ?? 1 }, () => null))
    }

    const row = nextMatrix[edit.row]
    if (!row) return

    const vObj = edit.value !== null
      ? { v: edit.value, m: edit.display }
      : { m: edit.display }
    row[edit.col] = vObj

    const updatedSheets = gridSheets.map((s) =>
      s === sheet ? cloneSheetWithData(s, nextMatrix) : s
    )
    replaceGridSheets(updatedSheets)
  } catch {
    // Silent fail — don't crash on malformed remote data
  }
}
