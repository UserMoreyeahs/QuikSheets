'use client'

import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'

export interface PresenceUser {
  userId: string
  displayName: string
  avatarUrl: string | null
  color: string
}

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

function pickColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]!
}

export function usePresence(workbookId: string, me: { userId: string; displayName: string; avatarUrl?: string | null } | null): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase || !me) return
    const channel = supabase.channel(`workbook:${workbookId}:presence`, {
      config: { presence: { key: me.userId } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const flat: PresenceUser[] = []
        for (const list of Object.values(state)) {
          for (const presence of list) flat.push(presence)
        }
        setUsers(flat)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: me.userId,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl ?? null,
            color: pickColor(me.userId),
          })
        }
      })
    return () => {
      void channel.unsubscribe()
    }
  }, [workbookId, me])

  return users
}
