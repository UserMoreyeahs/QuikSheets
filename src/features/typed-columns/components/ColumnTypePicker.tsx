'use client'

/**
 * ColumnTypePicker — small dropdown that lets a user assign one of the
 * seven typed-column types to a single column.
 *
 * Renders as a chip ("Aa" / "$" / "📅" etc.) over the column header.
 * Clicking it opens a Radix dropdown with the type list. Selecting
 * "Select" or "Status" prompts for comma-separated option labels.
 *
 * Hover the chip to see the current type label in a tooltip.
 *
 * The component is intentionally compact (icon-only) so it fits the
 * 20px-tall FortuneSheet column headers without disrupting layout.
 */

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  type ColumnType,
  type ColumnTypeMeta,
  COLUMN_TYPE_ICONS,
  COLUMN_TYPE_LABELS,
  STATUS_PRESETS,
} from '../types'

interface ColumnTypePickerProps {
  /** Current type meta (undefined → column is plain text). */
  meta: ColumnTypeMeta | undefined
  /** Called when the user picks a new type (or null to clear back to text). */
  onChange: (next: ColumnTypeMeta | null) => void
  /** Optional className for positioning. */
  className?: string
}

const SIMPLE_TYPES: ColumnType[] = ['text', 'number', 'currency', 'date', 'checkbox']

export function ColumnTypePicker({ meta, onChange, className }: ColumnTypePickerProps) {
  const [optionsPromptOpen, setOptionsPromptOpen] = useState<'select' | 'status' | null>(null)
  const [optionsInput, setOptionsInput] = useState('')

  function pickSimple(type: ColumnType) {
    onChange(type === 'text' ? null : { type })
  }

  function startOptionsPrompt(kind: 'select' | 'status') {
    // Default Status to the colored chip presets if nothing is set yet.
    const defaults =
      kind === 'status'
        ? STATUS_PRESETS.map((p) => p.label).join(', ')
        : (meta?.options ?? []).join(', ')
    setOptionsInput(defaults)
    setOptionsPromptOpen(kind)
  }

  function commitOptions() {
    if (!optionsPromptOpen) return
    const opts = optionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (opts.length === 0) {
      setOptionsPromptOpen(null)
      return
    }
    onChange({ type: optionsPromptOpen, options: opts })
    setOptionsPromptOpen(null)
  }

  const icon = meta ? COLUMN_TYPE_ICONS[meta.type] : COLUMN_TYPE_ICONS.text
  const label = meta ? COLUMN_TYPE_LABELS[meta.type] : 'Plain text'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`Column type: ${label}`}
            className={cn(
              'inline-flex h-[18px] min-w-[22px] items-center justify-center rounded border border-zinc-300 bg-white px-1 text-[10px] font-semibold leading-none text-zinc-600 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-500',
              meta && 'border-blue-400 text-blue-700 dark:border-blue-500 dark:text-blue-300',
              className,
            )}
          >
            {icon}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-400">
            Column type
          </DropdownMenuLabel>
          {SIMPLE_TYPES.map((t) => (
            <DropdownMenuItem
              key={t}
              onSelect={() => pickSimple(t)}
              className="flex items-center justify-between"
            >
              <span>
                <span className="mr-2 inline-block w-5 text-center font-semibold text-zinc-500">
                  {COLUMN_TYPE_ICONS[t]}
                </span>
                {COLUMN_TYPE_LABELS[t]}
              </span>
              {meta?.type === t && <span className="text-xs text-blue-600">✓</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => startOptionsPrompt('select')}>
            <span className="mr-2 inline-block w-5 text-center font-semibold text-zinc-500">
              {COLUMN_TYPE_ICONS.select}
            </span>
            {COLUMN_TYPE_LABELS.select}…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startOptionsPrompt('status')}>
            <span className="mr-2 inline-block w-5 text-center font-semibold text-zinc-500">
              {COLUMN_TYPE_ICONS.status}
            </span>
            {COLUMN_TYPE_LABELS.status}…
          </DropdownMenuItem>
          {meta && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange(null)} className="text-red-600">
                Clear column type
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline options prompt — small fixed-position dialog */}
      {optionsPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-32"
          onClick={() => setOptionsPromptOpen(null)}
        >
          <div
            className="w-[420px] rounded-md border border-zinc-300 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold">
              {optionsPromptOpen === 'status' ? 'Status options' : 'Select options'}
            </h3>
            <p className="mb-2 text-xs text-zinc-500">
              Comma-separated values. e.g. <code>Active, Pending, Done</code>
            </p>
            <input
              type="text"
              autoFocus
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitOptions()
                if (e.key === 'Escape') setOptionsPromptOpen(null)
              }}
              className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOptionsPromptOpen(null)}
                className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitOptions}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
