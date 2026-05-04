'use client'

/**
 * Presence store — tracks remote user cursors and selections.
 *
 * Each remote user presence record includes:
 *   - userId / name / color
 *   - current cell selection (row, col)
 *   - current sheet they're on
 *   - last seen timestamp
 *
 * Stale presences (> 30s with no update) are pruned automatically.
 */

import { create } from 'zustand'

export interface RemotePresence {
  userId: string
  name: string
  email: string
  /** Hex color assigned to this user's cursor overlay. */
  color: string
  /** Current selected cell — row index. */
  row: number
  /** Current selected cell — col index. */
  col: number
  /** Sheet ID the user is viewing. */
  sheetId: string
  /** Epoch ms of last presence update. */
  lastSeen: number
}

interface PresenceState {
  /** Map of userId → presence. */
  remoteUsers: Map<string, RemotePresence>
  /** Update or insert a remote user's presence. */
  upsertPresence: (presence: RemotePresence) => void
  /** Remove a user (they left). */
  removePresence: (userId: string) => void
  /** Prune stale presences older than maxAge ms. */
  pruneStale: (maxAgeMs?: number) => void
  /** Get all presences for a given sheet. */
  getForSheet: (sheetId: string) => RemotePresence[]
}

const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e',
]

let colorIndex = 0
function nextColor(): string {
  const c = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length] ?? '#3b82f6'
  colorIndex++
  return c
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  remoteUsers: new Map(),

  upsertPresence: (presence) =>
    set((state) => {
      const next = new Map(state.remoteUsers)
      const existing = next.get(presence.userId)
      next.set(presence.userId, {
        ...presence,
        color: existing?.color ?? nextColor(),
        lastSeen: Date.now(),
      })
      return { remoteUsers: next }
    }),

  removePresence: (userId) =>
    set((state) => {
      const next = new Map(state.remoteUsers)
      next.delete(userId)
      return { remoteUsers: next }
    }),

  pruneStale: (maxAgeMs = 30000) => {
    const state = get()
    const cutoff = Date.now() - maxAgeMs
    let hasStale = false
    for (const p of state.remoteUsers.values()) {
      if (p.lastSeen < cutoff) { hasStale = true; break }
    }
    // Only create new Map and trigger re-renders if something was actually pruned
    if (!hasStale) return
    const next = new Map<string, RemotePresence>()
    for (const [id, p] of state.remoteUsers) {
      if (p.lastSeen >= cutoff) next.set(id, p)
    }
    set({ remoteUsers: next })
  },

  getForSheet: (sheetId) => {
    const result: RemotePresence[] = []
    for (const p of get().remoteUsers.values()) {
      if (p.sheetId === sheetId) result.push(p)
    }
    return result
  },
}))
