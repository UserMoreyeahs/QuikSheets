'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useWorkbookStore } from '@/store/workbookStore'
import { SheetTab } from './SheetTab'
import { SheetContextMenu } from './SheetContextMenu'

interface ContextMenuState {
  sheetId: string
  x: number
  y: number
}

export function SheetTabsBar() {
  const { sheets, activeSheetId, addSheet, reorderSheets } = useWorkbookStore()

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dragFromId, setDragFromId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcut: Shift+F11 = add new sheet
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'F11') {
        e.preventDefault()
        addSheet()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addSheet])

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (!scrollRef.current) return
    const activeEl = scrollRef.current.querySelector('[data-active="true"]')
    activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeSheetId])

  const visibleSheets = [...sheets]
    .filter((s) => !s.isHidden)
    .sort((a, b) => a.order - b.order)

  function handleContextMenu(sheetId: string, x: number, y: number) {
    setContextMenu({ sheetId, x, y })
  }

  function handleDragStart(id: string) {
    setDragFromId(id)
  }

  function handleDrop(toId: string) {
    if (dragFromId && dragFromId !== toId) {
      reorderSheets(dragFromId, toId)
    }
    setDragFromId(null)
  }

  return (
    <div
      data-testid="sheet-tabs-bar"
      className="flex h-9 shrink-0 items-stretch border-t border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Scrollable tab list */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-stretch overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {visibleSheets.map((sheet) => (
          <div key={sheet.id} data-active={sheet.id === activeSheetId}>
            <SheetTab
              sheet={sheet}
              isActive={sheet.id === activeSheetId}
              onContextMenu={handleContextMenu}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          </div>
        ))}
      </div>

      {/* Add sheet button */}
      <button
        onClick={() => addSheet()}
        title="Add sheet (Shift+F11)"
        className="flex shrink-0 items-center justify-center border-l border-zinc-200 px-3 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <SheetContextMenu
          sheetId={contextMenu.sheetId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
