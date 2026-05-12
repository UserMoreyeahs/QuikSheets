'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNamedRangesStore, validateNamedRangeName, type NamedRange } from './namedRangesStore'
import { useWorkbookStore } from '@/store/workbookStore'

interface NameManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workbookId: string
}

export function NameManagerDialog({ open, onOpenChange, workbookId }: NameManagerDialogProps) {
  const { sheets } = useWorkbookStore()
  const names = useNamedRangesStore((s) => s.names[workbookId] ?? [])
  const { addName, updateName, deleteName, loadNames } = useNamedRangesStore()

  const [editing, setEditing] = useState<NamedRange | null>(null)
  const [draft, setDraft] = useState<NamedRange>({ name: '', range: '', scope: 'workbook', comment: '' })
  const [error, setError] = useState<string | null>(null)

  // Load names when dialog opens
  useEffect(() => {
    if (open) {
      loadNames(workbookId)
      setEditing(null)
      setDraft({ name: '', range: '', scope: 'workbook', comment: '' })
      setError(null)
    }
  }, [open, workbookId, loadNames])

  const scopeOptions = useMemo(
    () => [
      { value: 'workbook', label: 'Workbook' },
      ...sheets.map((s) => ({ value: s.id, label: `Sheet · ${s.name}` })),
    ],
    [sheets],
  )

  function handleSave() {
    const v = validateNamedRangeName(draft.name)
    if (!v.ok) {
      setError(v.error ?? 'Invalid name')
      return
    }
    if (!draft.range.trim()) {
      setError('Range is required')
      return
    }

    if (editing) {
      updateName(workbookId, editing.name, draft)
    } else {
      // Reject duplicates when adding new
      if (names.some((n) => n.name === draft.name)) {
        setError(`Name "${draft.name}" already exists`)
        return
      }
      addName(workbookId, draft)
    }
    setDraft({ name: '', range: '', scope: 'workbook', comment: '' })
    setEditing(null)
    setError(null)
  }

  function handleEdit(n: NamedRange) {
    setEditing(n)
    setDraft({ ...n })
    setError(null)
  }

  function handleDelete(name: string) {
    if (window.confirm(`Delete name "${name}"?`)) {
      deleteName(workbookId, name)
      if (editing?.name === name) {
        setEditing(null)
        setDraft({ name: '', range: '', scope: 'workbook', comment: '' })
      }
    }
  }

  function handleCancelEdit() {
    setEditing(null)
    setDraft({ name: '', range: '', scope: 'workbook', comment: '' })
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Name Manager</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {/* Name list */}
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
            <div className="grid grid-cols-[1.4fr_2fr_1.2fr_64px] gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              <span>Name</span>
              <span>Refers to</span>
              <span>Scope</span>
              <span className="text-right">Actions</span>
            </div>
            <ScrollArea className="h-[200px]">
              {names.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-zinc-500">
                  No defined names yet. Add one below.
                </div>
              ) : (
                <ul>
                  {names.map((n) => (
                    <li
                      key={n.name}
                      className="grid grid-cols-[1.4fr_2fr_1.2fr_64px] items-center gap-2 border-b border-zinc-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <span className="font-mono">{n.name}</span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{n.range}</span>
                      <span className="text-xs text-zinc-500">
                        {n.scope === 'workbook'
                          ? 'Workbook'
                          : `Sheet · ${sheets.find((s) => s.id === n.scope)?.name ?? '?'}`}
                      </span>
                      <span className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(n)}
                          aria-label="Edit"
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(n.name)}
                          aria-label="Delete"
                          className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Edit / add row */}
          <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {editing ? `Editing "${editing.name}"` : 'Define new name'}
              </span>
              {editing ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-3 w-3" />
                  Cancel edit
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-[1.4fr_2fr_1.2fr] gap-2">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="MyRange"
                className="font-mono text-sm"
              />
              <Input
                value={draft.range}
                onChange={(e) => setDraft({ ...draft, range: e.target.value })}
                placeholder="A1:C10 or Sheet1!A1:C10"
                className="font-mono text-sm"
              />
              <select
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {scopeOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              value={draft.comment ?? ''}
              onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
              placeholder="Comment (optional)"
              className="mt-2 text-sm"
            />

            {error ? (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
            ) : null}

            <div className="mt-3 flex justify-end">
              <Button onClick={handleSave} className="gap-1">
                <Plus className="h-3 w-3" />
                {editing ? 'Save changes' : 'Add'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
