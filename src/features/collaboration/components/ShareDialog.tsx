'use client'

import { useState, useTransition, useEffect } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import {
  inviteMemberAction,
  listMembersAction,
  removeMemberAction,
  updateMemberRoleAction,
  type MemberRow,
} from '@/features/collaboration/actions'

interface ShareDialogProps {
  workbookId: string
  open: boolean
  onClose: () => void
}

export function ShareDialog({ workbookId, open, onClose }: ShareDialogProps) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    listMembersAction(workbookId).then(setMembers).catch(() => setMembers([]))
  }, [open, workbookId])

  if (!open) return null

  const refresh = async () => {
    const next = await listMembersAction(workbookId).catch(() => [])
    setMembers(next)
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Share workbook</h3>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
            Close
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            startTransition(async () => {
              const result = await inviteMemberAction({ workbookId, email, role })
              if (!result.ok) setError(result.error)
              else {
                setEmail('')
                await refresh()
              }
            })
          }}
          className="mb-4 flex gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            required
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            className="rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </button>
        </form>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-zinc-500">Members</p>
          {members.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-sm text-zinc-500">
              No members yet — invite by email to share access.
            </p>
          ) : (
            members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {m.displayName ?? m.email ?? m.userId.slice(0, 8)}
                  </p>
                  {m.email ? <p className="text-xs text-zinc-500">{m.email}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => {
                      const newRole = e.target.value as 'owner' | 'editor' | 'viewer'
                      startTransition(async () => {
                        await updateMemberRoleAction({ workbookId, userId: m.userId, role: newRole })
                        await refresh()
                      })
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await removeMemberAction({ workbookId, userId: m.userId })
                        await refresh()
                      })
                    }
                    className="rounded-md p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                    aria-label="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
