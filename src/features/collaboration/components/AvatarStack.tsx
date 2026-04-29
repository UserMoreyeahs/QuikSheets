'use client'

import type { PresenceUser } from '../hooks/usePresence'

interface AvatarStackProps {
  users: PresenceUser[]
  max?: number
}

export function AvatarStack({ users, max = 5 }: AvatarStackProps) {
  if (users.length === 0) return null
  const visible = users.slice(0, max)
  const overflow = users.length - visible.length

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u) => (
        <div
          key={u.userId}
          title={u.displayName}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm dark:border-zinc-900"
          style={{ backgroundColor: u.color }}
        >
          {u.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full rounded-full object-cover" />
          ) : (
            (u.displayName[0] ?? '?').toUpperCase()
          )}
        </div>
      ))}
      {overflow > 0 ? (
        <div className="flex h-7 min-w-[28px] items-center justify-center rounded-full border-2 border-white bg-zinc-700 px-1.5 text-[10px] font-semibold text-white shadow-sm dark:border-zinc-900">
          +{overflow}
        </div>
      ) : null}
    </div>
  )
}
