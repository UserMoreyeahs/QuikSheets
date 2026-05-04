'use client'

/**
 * RemoteCursors
 * -------------
 * Renders colored cursor overlays for each remote user on the current sheet.
 * Each cursor shows the user's name tag and highlights their selected cell.
 *
 * Positioned using FortuneSheet's default cell sizing (same assumptions as
 * useGridScroll + FillHandle).
 *
 * IMPORTANT: Zustand selectors must return stable references. Never create
 * a new array/object inside a selector — that causes an infinite re-render
 * loop ("getSnapshot should be cached").  Select the Map, derive in useMemo.
 */

import { useMemo } from 'react'
import { usePresenceStore, type RemotePresence } from '../store/presenceStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { useGridScroll } from '@/features/grid/hooks/useGridScroll'

const ROW_HEIGHT = 20
const COL_WIDTH = 73
const HEADER_WIDTH = 46
const HEADER_HEIGHT = 20

/**
 * Outer component — only subscribes to the presence Map.
 * Heavy hooks (useGridScroll) only mount when remote users exist.
 */
export function RemoteCursors() {
  const remoteUsers = usePresenceStore((s) => s.remoteUsers)
  if (remoteUsers.size === 0) return null
  return <RemoteCursorsInner />
}

/** Inner component — mounts useGridScroll only when needed. */
function RemoteCursorsInner() {
  const { activeSheetId } = useWorkbookStore()
  const remoteUsers = usePresenceStore((s) => s.remoteUsers)
  const scroll = useGridScroll()

  const presences = useMemo(() => {
    const result: RemotePresence[] = []
    for (const p of remoteUsers.values()) {
      if (p.sheetId === (activeSheetId ?? '')) result.push(p)
    }
    return result
  }, [remoteUsers, activeSheetId])

  if (presences.length === 0) return null

  return (
    <>
      {presences.map((p) => (
        <CursorOverlay key={p.userId} presence={p} scroll={scroll} />
      ))}
    </>
  )
}

function CursorOverlay({
  presence,
  scroll,
}: {
  presence: RemotePresence
  scroll: { scrollLeft: number; scrollTop: number }
}) {
  const x = HEADER_WIDTH + presence.col * COL_WIDTH - scroll.scrollLeft
  const y = HEADER_HEIGHT + presence.row * ROW_HEIGHT - scroll.scrollTop

  // Don't render if the cell is scrolled out of view
  if (x < HEADER_WIDTH - COL_WIDTH || y < HEADER_HEIGHT - ROW_HEIGHT) return null

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{ left: x, top: y }}
    >
      {/* Cell highlight */}
      <div
        className="absolute rounded-sm"
        style={{
          width: COL_WIDTH,
          height: ROW_HEIGHT,
          border: `2px solid ${presence.color}`,
          backgroundColor: `${presence.color}15`,
        }}
      />
      {/* Name tag */}
      <div
        className="absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
        style={{ backgroundColor: presence.color }}
      >
        {presence.name}
      </div>
    </div>
  )
}

/**
 * PresenceAvatars — shows small colored dots for all connected users
 * in a corner of the header/toolbar area.
 */
export function PresenceAvatars() {
  // Select the stable Map reference — do NOT create arrays inside the selector
  const remoteUsers = usePresenceStore((s) => s.remoteUsers)

  const allUsers = useMemo(
    () => Array.from(remoteUsers.values()),
    [remoteUsers],
  )

  if (allUsers.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-2">
      {allUsers.slice(0, 8).map((u) => (
        <div
          key={u.userId}
          title={u.name || u.email || u.userId.slice(0, 6)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
          style={{ backgroundColor: u.color }}
        >
          {(u.name || u.email || '?')[0]?.toUpperCase()}
        </div>
      ))}
      {allUsers.length > 8 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-[9px] font-bold text-zinc-700">
          +{allUsers.length - 8}
        </div>
      )}
    </div>
  )
}
