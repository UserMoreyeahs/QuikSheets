'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { cn } from '@/lib/utils'

export function FindReplace() {
  const { showFindReplace, setShowFindReplace, findInGrid, replaceInGrid, findResults } =
    useSheetStore()

  const [searchValue, setSearchValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [matchEntireCell, setMatchEntireCell] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [isReplaceMode, setIsReplaceMode] = useState(false)
  const [replaceCount, setReplaceCount] = useState<number | null>(null)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const searchOptions = useMemo(
    () => ({ matchCase, matchEntireCell, useRegex }),
    [matchCase, matchEntireCell, useRegex]
  )

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey

      if (ctrlKey && event.key === 'f') {
        event.preventDefault()
        setShowFindReplace(true)
        setIsReplaceMode(false)
        setTimeout(() => searchRef.current?.focus(), 50)
      }

      if (ctrlKey && event.key === 'h') {
        event.preventDefault()
        setShowFindReplace(true)
        setIsReplaceMode(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      }

      if (event.key === 'Escape' && showFindReplace) {
        setShowFindReplace(false)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setShowFindReplace, showFindReplace])

  useEffect(() => {
    if (!searchValue.trim()) return
    findInGrid(searchValue, searchOptions)
    setCurrentMatchIndex(0)
  }, [findInGrid, searchOptions, searchValue])

  const handlePrevMatch = useCallback(() => {
    if (findResults.length === 0) return
    setCurrentMatchIndex((index) => (index - 1 + findResults.length) % findResults.length)
  }, [findResults.length])

  const handleNextMatch = useCallback(() => {
    if (findResults.length === 0) return
    setCurrentMatchIndex((index) => (index + 1) % findResults.length)
  }, [findResults.length])

  const handleReplaceAll = useCallback(() => {
    if (!searchValue.trim()) return
    const count = replaceInGrid(searchValue, replaceValue, searchOptions)
    setReplaceCount(count)
  }, [replaceInGrid, replaceValue, searchOptions, searchValue])

  const handleReplaceNext = useCallback(() => {
    if (!searchValue.trim() || findResults.length === 0) return
    const match = findResults[currentMatchIndex]
    if (!match) return

    const count = replaceInGrid(match.value, replaceValue, {
      matchCase: true,
      matchEntireCell: true,
      useRegex: false,
    })

    setReplaceCount(count)
  }, [currentMatchIndex, findResults, replaceInGrid, replaceValue, searchValue])

  if (!showFindReplace) return null

  const currentMatch = findResults[currentMatchIndex]

  return (
    <div className="fixed right-4 top-[130px] z-50 w-[380px] rounded-xl border border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex gap-3">
          <button
            onClick={() => {
              setIsReplaceMode(false)
              setReplaceCount(null)
            }}
            className={cn(
              'text-xs font-medium transition-colors',
              !isReplaceMode ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
            )}
          >
            Find
          </button>
          <button
            onClick={() => {
              setIsReplaceMode(true)
              setReplaceCount(null)
            }}
            className={cn(
              'text-xs font-medium transition-colors',
              isReplaceMode ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
            )}
          >
            Replace
          </button>
        </div>
        <button
          onClick={() => setShowFindReplace(false)}
          className="text-zinc-400 transition-colors hover:text-zinc-600"
        >
          x
        </button>
      </div>

      <div className="space-y-2 px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (event.shiftKey) {
                  handlePrevMatch()
                } else {
                  handleNextMatch()
                }
              }
            }}
            placeholder="Search..."
            autoFocus
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-blue-50"
          />
          <button
            onClick={handlePrevMatch}
            disabled={findResults.length === 0}
            title="Previous match (Shift+Enter)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            onClick={handleNextMatch}
            disabled={findResults.length === 0}
            title="Next match (Enter)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-40"
          >
            ↓
          </button>
        </div>

        {isReplaceMode && (
          <input
            type="text"
            value={replaceValue}
            onChange={(event) => setReplaceValue(event.target.value)}
            placeholder="Replace with..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        )}

        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Match case', value: matchCase, setValue: setMatchCase },
            { label: 'Entire cell', value: matchEntireCell, setValue: setMatchEntireCell },
            { label: 'Regex', value: useRegex, setValue: setUseRegex },
          ].map((option) => (
            <label
              key={option.label}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500"
            >
              <input
                type="checkbox"
                checked={option.value}
                onChange={(event) => option.setValue(event.target.checked)}
                className="rounded"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {searchValue.trim() && (
        <div className="border-t border-zinc-100 px-4 py-2">
          {findResults.length === 0 ? (
            <p className="text-xs text-zinc-400">No matches found</p>
          ) : (
            <p className="text-xs text-zinc-500">
              Match <span className="font-medium text-zinc-800">{currentMatchIndex + 1}</span> of{' '}
              <span className="font-medium text-zinc-800">{findResults.length}</span>
              {currentMatch && (
                <span className="ml-2 text-zinc-400">
                  (row {currentMatch.row + 1}, col {currentMatch.col + 1})
                </span>
              )}
            </p>
          )}

          {replaceCount !== null && (
            <p className="mt-1 text-xs text-green-600">
              {replaceCount === 0
                ? 'No replacements made'
                : `Replaced ${replaceCount} cell${replaceCount !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      )}

      {isReplaceMode && (
        <div className="flex gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            onClick={handleReplaceNext}
            disabled={findResults.length === 0}
            className="flex-1 rounded-lg border border-zinc-200 py-2 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            Replace Next
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={findResults.length === 0}
            className="flex-1 rounded-lg bg-zinc-900 py-2 text-xs text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            Replace All
          </button>
        </div>
      )}
    </div>
  )
}
