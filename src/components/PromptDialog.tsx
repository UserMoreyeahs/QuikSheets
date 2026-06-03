'use client'

/**
 * PromptDialog — drop-in replacement for `window.prompt()`.
 *
 * Why: Next.js 15 + modern browsers block window.prompt() with
 *   "prompt() is not supported"
 * (also a long-standing UX problem — synchronous prompts freeze the
 * tab and can't be styled). The fix is a single mounted dialog +
 * a Promise-based imperative API so call sites read almost identically:
 *
 *   // before:
 *   const name = window.prompt('Define a name:', '')
 *
 *   // after:
 *   const name = await promptDialog({ title: 'Define a name' })
 *
 * The dialog mounts once at the app root (sheet page + dashboard).
 * Calls from anywhere — including async functions in stores or
 * non-React code — resolve to the user's input or `null` on cancel.
 */

import { useEffect, useState, useRef } from 'react'
import { create } from 'zustand'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export interface PromptOptions {
  /** Modal title (required — replaces the old prompt's message). */
  title: string
  /** Long-form explanation under the title. */
  message?: string
  /** Pre-filled default. */
  defaultValue?: string
  /** Visible placeholder when the input is empty. */
  placeholder?: string
  /** Label for the OK button. Defaults to "OK". */
  confirmLabel?: string
  /** Label for the Cancel button. Defaults to "Cancel". */
  cancelLabel?: string
  /** Use a textarea instead of a single-line input. */
  multiline?: boolean
  /** Input type attribute (number, url, email…). Ignored for multiline. */
  inputType?: 'text' | 'number' | 'url' | 'email'
}

interface DialogState extends PromptOptions {
  open: boolean
  resolve: ((value: string | null) => void) | null
}

interface PromptStore {
  state: DialogState
  open: (opts: PromptOptions, resolve: (value: string | null) => void) => void
  close: (value: string | null) => void
}

const initialState: DialogState = {
  open: false,
  title: '',
  resolve: null,
}

const usePromptDialogStore = create<PromptStore>((set, get) => ({
  state: initialState,
  open: (opts, resolve) => set({ state: { ...initialState, ...opts, open: true, resolve } }),
  close: (value) => {
    const { state } = get()
    state.resolve?.(value)
    set({ state: initialState })
  },
}))

/**
 * Imperative replacement for `window.prompt()`. Returns the entered
 * string on confirm, or `null` on cancel / close.
 */
export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    usePromptDialogStore.getState().open(opts, resolve)
  })
}

/**
 * Mount this once at the app root. It listens to the global store and
 * renders the dialog when promptDialog() is called.
 */
export function PromptDialog() {
  const state = usePromptDialogStore((s) => s.state)
  const close = usePromptDialogStore((s) => s.close)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // Sync local value with the new default whenever the dialog opens.
  useEffect(() => {
    if (!state.open) return
    setValue(state.defaultValue ?? '')
    // Defer focus so the dialog finishes mounting.
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      if (inputRef.current && 'select' in inputRef.current) {
        // Highlight default so user can overwrite or accept with Enter.
        ;(inputRef.current as HTMLInputElement).select()
      }
    }, 50)
    return () => window.clearTimeout(timer)
  }, [state.open, state.defaultValue])

  function confirm() {
    close(value)
  }
  function cancel() {
    close(null)
  }

  // Single-line: submit on Enter. Multiline: Ctrl/Cmd+Enter submits.
  function onKeyDown(e: React.KeyboardEvent) {
    if (state.multiline) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        confirm()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => { if (!o) cancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.message && <DialogDescription>{state.message}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-2 pt-1">
          {state.multiline ? (
            <textarea
              ref={(el) => { inputRef.current = el }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={state.placeholder}
              rows={4}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          ) : (
            <input
              ref={(el) => { inputRef.current = el }}
              type={state.inputType ?? 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={state.placeholder}
              className="h-9 w-full rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
          {state.multiline && (
            <p className="text-[10px] text-zinc-500">
              Press <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-700">Ctrl</kbd> + <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-700">Enter</kbd> to confirm.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {state.confirmLabel ?? 'OK'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
