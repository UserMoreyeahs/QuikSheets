'use client'

import React, { useRef, useState } from 'react'
import { useWorkbookStore } from '@/store/workbookStore'
import { cn } from '@/lib/utils'
import type { SheetTab as SheetTabType } from '@/types/sheet.types'

interface SheetTabProps {
  sheet: SheetTabType
  isActive: boolean
  onContextMenu: (sheetId: string, x: number, y: number) => void
  onDragStart: (id: string) => void
  onDrop: (id: string) => void
}

export function SheetTab({ sheet, isActive, onContextMenu, onDragStart, onDrop }: SheetTabProps) {
  const { setActiveSheet, renameSheet } = useWorkbookStore()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(sheet.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    if (!isActive) setActiveSheet(sheet.id)
  }

  function handleDoubleClick() {
    setRenameValue(sheet.name)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== sheet.name) {
      renameSheet(sheet.id, trimmed)
    }
    setIsRenaming(false)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setIsRenaming(false)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    onContextMenu(sheet.id, e.clientX, e.clientY)
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(sheet.id)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    onDrop(sheet.id)
  }

  return (
    <div
      draggable
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'group relative flex min-w-[80px] max-w-[160px] cursor-pointer select-none items-center px-4 py-2 text-xs transition-colors',
        isActive
          ? 'bg-white text-zinc-900 shadow-[inset_0_-2px_0_0_#3b82f6] dark:bg-zinc-800 dark:text-zinc-50'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        isDragOver && 'ring-2 ring-blue-400 ring-inset',
        'border-r border-zinc-200 first:border-l dark:border-zinc-800'
      )}
    >
      {/* Color bar */}
      {sheet.color && (
        <span
          className="absolute inset-x-0 top-0 h-0.5 rounded-t"
          style={{ backgroundColor: sheet.color }}
        />
      )}

      {isRenaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full min-w-[60px] bg-transparent text-xs outline-none ring-0"
          style={{ width: `${Math.max(60, renameValue.length * 7)}px` }}
        />
      ) : (
        <span className="truncate">{sheet.name}</span>
      )}
    </div>
  )
}
