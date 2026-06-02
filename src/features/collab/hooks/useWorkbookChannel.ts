'use client'

/**
 * useWorkbookChannel
 * ------------------
 * Returns a single shared Supabase Realtime channel per workbook ID.
 *
 * Problem it solves
 * -----------------
 * Previously each collab hook (useRealtimeCollab, useBroadcast, usePresence)
 * opened its own channel, meaning 3 channels per user per workbook.  With
 * 5 concurrent editors that's 15 channels — Supabase has per-project limits.
 *
 * Design
 * ------
 * - Module-level ref-counted map: channelName → { channel, subscriberCount }.
 * - First hook to mount for a given workbookId creates and subscribes the
 *   channel.  Subsequent hooks just bump the ref count and receive the same
 *   channel instance.
 * - Each hook cleanup decrements the ref count; when it hits 0 the channel
 *   is unsubscribed and removed from the registry.
 * - All three event namespaces (cell_edit, cursor, presence) travel over the
 *   SAME channel via Supabase Broadcast's `event` discriminator.
 *
 * Reactivity
 * ----------
 * The channel is exposed via React state so that consumer hooks re-render
 * once the channel is ready (after the first mount effect fires).
 *
 * External API
 * ------------
 * Callers receive a stable RealtimeChannel reference for the lifetime of the
 * shared subscription.  They MUST NOT call .unsubscribe() themselves — the
 * hook handles teardown via its cleanup return.
 *
 * Graceful fallback: returns null when Supabase is not configured, so all
 * consumer hooks remain no-ops in single-user mode.
 */

import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChannelEntry {
  channel: RealtimeChannel
  subscribers: number
}

/** Module-level registry — one entry per channelName, shared across React trees. */
const registry = new Map<string, ChannelEntry>()

/**
 * Returns the shared Realtime channel for `workbookId`.
 * The channel is created (and subscribed) on first use and torn down when the
 * last subscriber unmounts.  The returned value updates reactively once the
 * effect has fired (null → channel).
 */
export function useWorkbookChannel(workbookId: string): RealtimeChannel | null {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase || !workbookId) return

    const channelName = `workbook:${workbookId}`
    let entry = registry.get(channelName)

    if (!entry) {
      // First subscriber — create and subscribe the channel.
      // broadcast.self: false → don't echo our own messages back.
      const ch = supabase.channel(channelName, {
        config: { broadcast: { self: false, ack: false } },
      })
      ch.subscribe()
      entry = { channel: ch, subscribers: 0 }
      registry.set(channelName, entry)
    }

    entry.subscribers++
    setChannel(entry.channel)

    return () => {
      setChannel(null)
      const e = registry.get(channelName)
      if (!e) return
      e.subscribers--
      if (e.subscribers <= 0) {
        void e.channel.unsubscribe()
        registry.delete(channelName)
      }
    }
  }, [workbookId])

  return channel
}

/** Test helper — clears the internal registry between tests. */
export function __resetChannelRegistryForTests(): void {
  registry.clear()
}
