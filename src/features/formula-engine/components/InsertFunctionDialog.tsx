'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
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
import { useSheetStore } from '@/store/sheetStore'
import { FORMULA_LIST, CATEGORY_COLORS, type FormulaCategory, type FormulaEntry } from '../formulaList'

interface InsertFunctionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORIES: ('All' | FormulaCategory)[] = [
  'All', 'Math', 'Statistical', 'Text', 'Logical', 'Lookup', 'Date',
  'Financial', 'Information', 'Engineering',
]

export function InsertFunctionDialog({ open, onOpenChange }: InsertFunctionDialogProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | FormulaCategory>('All')
  const [selectedFn, setSelectedFn] = useState<FormulaEntry | null>(FORMULA_LIST[0] ?? null)

  // Reset filter / selection on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setCategory('All')
      setSelectedFn(FORMULA_LIST[0] ?? null)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FORMULA_LIST.filter((f) => {
      if (category !== 'All' && f.category !== category) return false
      if (!q) return true
      return (
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q)
      )
    })
  }, [query, category])

  function handleInsert() {
    if (!selectedFn) return
    const { selectedCell, setFormulaBarValue, setEditingCell } = useSheetStore.getState()
    setFormulaBarValue(`=${selectedFn.name}(`)
    if (selectedCell) setEditingCell(selectedCell)
    onOpenChange(false)
    // Focus the formula bar so the user can type the args
    requestAnimationFrame(() => {
      const input = document.querySelector('.formula-bar-input') as HTMLInputElement | null
      if (input) {
        input.focus()
        const len = input.value.length
        input.setSelectionRange(len, len)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Insert Function</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {/* Search + category */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a function (e.g. SUM, lookup, average)…"
                className="pl-8"
                autoFocus
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'All' | FormulaCategory)}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[260px_1fr] gap-3 rounded-md border border-zinc-200 dark:border-zinc-700">
            {/* Function list */}
            <ScrollArea className="h-[320px] border-r border-zinc-200 dark:border-zinc-700">
              <ul className="py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-4 text-center text-sm text-zinc-500">No functions match</li>
                ) : (
                  filtered.map((fn) => (
                    <li key={fn.name}>
                      <button
                        type="button"
                        onClick={() => setSelectedFn(fn)}
                        onDoubleClick={() => { setSelectedFn(fn); handleInsert() }}
                        className={[
                          'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm',
                          selectedFn?.name === fn.name
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                        ].join(' ')}
                      >
                        <span className="font-mono">{fn.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${CATEGORY_COLORS[fn.category]}`}>
                          {fn.category}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </ScrollArea>

            {/* Selected function detail */}
            <div className="flex flex-col gap-3 p-4">
              {selectedFn ? (
                <>
                  <div className="font-mono text-sm font-semibold">{selectedFn.name}</div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {selectedFn.syntax}
                  </div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-200">
                    {selectedFn.description}
                  </div>
                  <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="text-zinc-400">Example:</span> {selectedFn.example}
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-zinc-500">Pick a function</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleInsert} disabled={!selectedFn}>OK · Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
