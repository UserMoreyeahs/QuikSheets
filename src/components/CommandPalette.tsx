'use client'

import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface CommandPaletteItem {
  id: string
  label: string
  category: 'Navigation' | 'Actions' | 'AI' | 'View'
  keywords?: string[]
  onExecute: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  items: CommandPaletteItem[]
  onOpenChange: (isOpen: boolean) => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function CommandPalette({ isOpen, items, onOpenChange }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const ctrlOrCmd = navigator.platform.toUpperCase().includes('MAC') ? event.metaKey : event.ctrlKey
      if (!ctrlOrCmd || event.key.toLowerCase() !== 'k') return

      event.preventDefault()
      onOpenChange(!isOpen)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpenChange])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setActiveIndex(0)
      return
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return items

    return items.filter((item) => {
      const haystack = [item.label, item.category, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [items, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const groupedItems = useMemo(() => {
    const groups = new Map<CommandPaletteItem['category'], CommandPaletteItem[]>()
    filteredItems.forEach((item) => {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item])
    })
    return Array.from(groups.entries())
  }, [filteredItems])

  const executeItem = useCallback(
    (item: CommandPaletteItem | undefined) => {
      if (!item) return
      item.onExecute()
      onOpenChange(false)
    },
    [onOpenChange]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[120] bg-zinc-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div className="mx-auto mt-[12vh] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex h-14 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-700">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onOpenChange(false)
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, filteredItems.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                executeItem(filteredItems[activeIndex])
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            placeholder="Search commands..."
          />
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
            Esc
          </kbd>
        </div>

        <div className="max-h-[56vh] overflow-y-auto px-2 py-3">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No commands found
            </div>
          ) : (
            groupedItems.map(([category, categoryItems]) => (
              <div key={category} className="mb-3 last:mb-0">
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {category}
                </div>
                <div className="space-y-1">
                  {categoryItems.map((item) => {
                    const globalIndex = filteredItems.findIndex((candidate) => candidate.id === item.id)
                    const isActive = globalIndex === activeIndex

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => executeItem(item)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700'
                        )}
                      >
                        <span>{item.label}</span>
                        {isActive && <span className="text-[10px] text-current opacity-70">Enter</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export { isEditableTarget }
