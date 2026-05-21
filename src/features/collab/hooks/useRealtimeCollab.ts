'use client'

/**
 * useRealtimeCollab
 * -----------------
 * Wires Supabase Realtime for multi-user co-editing:
 *
 *   1. Joins a Realtime channel scoped to the workbook ID.
 *   2. Broadcasts local cell selection changes → other users see cursors.
 *   3. Broadcasts cell edits → other users receive updated cell data.
 *   4. Tracks remote presence (who's here, what they're looking at).
 *
 * Graceful fallback: when Supabase is not configured, the hook is a no-op —
 * the app works in single-user mode with no errors.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { usePresenceStore } from '../store/presenceStore'
import { useSheetStore } from '@/store/sheetStore'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const upsertPresence = usePresenceStore((s) => s.upsertPresence)
  const removePresence = usePresenceStore((s) => s.removePresence)
  const pruneStale = usePresenceStore((s) => s.pruneStale)

  // Identity priority:
  //  1. Authenticated Supabase user id (so two tabs from the same user
  //     appear as ONE presence — the previous behaviour gave each tab a
  //     fresh random UUID and showed the user as a duplicate).
  //  2. Fallback to a stable per-session anon UUID.
  //
  // We render anon first to avoid blocking the channel subscription on
  // the auth round-trip, then upgrade when getUser() returns.
  const anonIdRef = useRef<string>('')
  if (!anonIdRef.current) {
    anonIdRef.current = typeof crypto !== 'undefined'
      ? crypto.randomUUID()
      : `anon-${Math.random().toString(36).slice(2, 10)}`
  }
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
  const userId = authUser?.id ?? anonIdRef.current
  const userName = authUser?.name ?? `User ${anonIdRef.current.slice(0, 4)}`
  const userEmail = authUser?.email ?? ''

  // ── Join channel on mount ──────────────────────────────────────
  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase || !workbookId) return

    const channelName = `workbook:${workbookId}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    // Listen for broadcasts
    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const p = payload as CursorPayload
        if (p.userId === userId) return
        upsertPresence({
          userId: p.userId,
          name: p.name || `User ${p.userId.slice(0, 4)}`,
          email: p.email || '',
          color: '', // will be assigned by store
          row: p.row,
          col: p.col,
          sheetId: p.sheetId,
          lastSeen: Date.now(),
        })
      })
      .on('broadcast', { event: 'cell_edit' }, ({ payload }) => {
        const p = payload as CellEditPayload
        if (p.userId === userId) return
        // Apply remote edit to local grid
        applyRemoteEdit(p)
      })
      .subscribe()

    channelRef.current = channel

    // Prune stale presences periodically
    const pruneInterval = setInterval(() => pruneStale(), 15000)

    return () => {
      clearInterval(pruneInterval)
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [workbookId, userId, upsertPresence, removePresence, pruneStale])

  // ── Broadcast local cursor ─────────────────────────────────────
  const broadcastCursor = useCallback(
    (sheetId: string, row: number, col: number) => {
      const channel = channelRef.current
      if (!channel) return
      channel.send({
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
    [userId, userName, userEmail],
  )

  // ── Broadcast cell edit ────────────────────────────────────────
  const broadcastEdit = useCallback(
    (sheetId: string, row: number, col: number, value: string | number | null, display: string) => {
      const channel = channelRef.current
      if (!channel) return
      channel.send({
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
    [userId],
  )

  return {
    userId,
    broadcastCursor,
    broadcastEdit,
    isConnected: channelRef.current !== null,
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
