'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'

export interface CursorPayload {
  userId: string
  displayName: string
  color: string
  sheetId: string
  row: number
  col: number
}

export function useBroadcast(workbookId: string, me: { userId: string; displayName: string; color: string } | null) {
  const [cursors, setCursors] = useState<Record<string, CursorPayload>>({})
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getBrowserSupabase>>['channel']> | null>(null)
  const lastSendRef = useRef<number>(0)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase || !me) return
    const channel = supabase.channel(`workbook:${workbookId}:cursor`, {
      config: { broadcast: { self: false, ack: false } },
    })
    channelRef.current = channel
    channel
      .on('broadcast', { event: 'cursor' }, (payload: { payload: CursorPayload }) => {
        if (!payload.payload) return
        if (payload.payload.userId === me.userId) return
        setCursors((prev) => ({ ...prev, [payload.payload.userId]: payload.payload }))
      })
      .subscribe()

    return () => {
      void channel.unsubscribe()
      channelRef.current = null
    }
  }, [workbookId, me])

  const broadcastCursor = useCallback(
    (sheetId: string, row: number, col: number) => {
      const channel = channelRef.current
      if (!channel || !me) return
      const now = performance.now()
      // Throttle to ~30Hz
      if (now - lastSendRef.current < 33) return
      lastSendRef.current = now
      void channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { userId: me.userId, displayName: me.displayName, color: me.color, sheetId, row, col } satisfies CursorPayload,
      })
    },
    [me]
  )

  return { cursors, broadcastCursor }
}
