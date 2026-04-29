'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface KeyboardShortcutsProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const SHORTCUT_GROUPS = [
  {
    category: 'Navigation',
    shortcuts: [
      ['Ctrl+PgUp/PgDn', 'Switch sheets'],
      ['Ctrl+Home/End', 'Jump to sheet edges'],
    ],
  },
  {
    category: 'Editing',
    shortcuts: [
      ['F2', 'Edit cell'],
      ['Delete', 'Clear cell'],
      ['Ctrl+D', 'Fill down'],
    ],
  },
  {
    category: 'Formatting',
    shortcuts: [
      ['Ctrl+B / I / U', 'Bold, italic, underline'],
      ['Ctrl+Shift+1-7', 'Number formats'],
    ],
  },
  {
    category: 'AI Features',
    shortcuts: [
      ['=?', 'AI formula assistant'],
      ['Ctrl+`', 'Private scratchpad'],
      ['Ctrl+M', 'Dependency map'],
    ],
  },
  {
    category: 'File',
    shortcuts: [
      ['Ctrl+S', 'Save'],
      ['Ctrl+Z / Y', 'Undo and redo'],
    ],
  },
  {
    category: 'View',
    shortcuts: [
      ['Ctrl+K', 'Command palette'],
      ['?', 'Keyboard shortcuts'],
      ['Ctrl+F / H', 'Find and replace'],
    ],
  },
]

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function KeyboardShortcuts({ isOpen, onOpenChange }: KeyboardShortcutsProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        onOpenChange(false)
        return
      }

      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      onOpenChange(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpenChange])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.category} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map(([keys, description]) => (
                  <div key={keys} className="flex items-center justify-between gap-4">
                    <kbd className="rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {keys}
                    </kbd>
                    <span className="text-right text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
