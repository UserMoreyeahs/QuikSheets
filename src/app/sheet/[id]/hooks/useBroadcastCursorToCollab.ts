'use client'

import { useEffect } from 'react'
import type { CellAddress } from '@/types/sheet.types'

/**
 * Broadcast the local cursor (selectedCell on the active sheet) to
 * other Realtime collaborators whenever the selection changes.
 *
 * NOTE: pass `broadcastCursor` itself (the stable useCallback ref
 * from useRealtimeCollab) rather than the whole `collab` object —
 * the latter is recreated on every render and would put us in an
 * infinite re-broadcast loop. See the original inline comment in
 * page.tsx for the gory history.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useBroadcastCursorToCollab(
  selectedCell: CellAddress | null,
  activeSheetId: string | null,
  broadcastCursor: (sheetId: string, row: number, col: number) => void,
): void {
  useEffect(() => {
    if (selectedCell && activeSheetId) {
      broadcastCursor(activeSheetId, selectedCell.row, selectedCell.col)
    }
  }, [selectedCell, activeSheetId, broadcastCursor])
}
