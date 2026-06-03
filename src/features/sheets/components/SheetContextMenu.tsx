'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cloneFortuneData } from '@/lib/fortuneSheet'
import { createDefaultSheet } from '@/lib/defaultSheet'
import { useWorkbookStore } from '@/store/workbookStore'
import { useSheetStore } from '@/store/sheetStore'
import { SheetColorPicker } from './SheetColorPicker'
import type { SheetContextMenuAction } from '@/types/sheet.types'
import type { Sheet } from '@fortune-sheet/core'

interface SheetContextMenuProps {
  sheetId: string
  x: number
  y: number
  onClose: () => void
}

interface MenuItem {
  action: SheetContextMenuAction
  label: string
  danger?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { action: 'rename', label: 'Rename' },
  { action: 'duplicate', label: 'Duplicate' },
  { action: 'move_left', label: 'Move left' },
  { action: 'move_right', label: 'Move right' },
  { action: 'hide', label: 'Hide sheet' },
  { action: 'color', label: 'Tab color ->' },
  { action: 'delete', label: 'Delete', danger: true },
]

function createSheetId(): string {
  return `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function SheetContextMenu({ sheetId, x, y, onClose }: SheetContextMenuProps) {
  const { sheets, removeSheet, renameSheet, hideSheet, setSheetColor, moveSheet, replaceSheets } =
    useWorkbookStore()
  const { gridSheets, replaceGridSheets, setSkipNextTabSync } = useSheetStore()

  const menuRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [position, setPosition] = useState({ left: x, top: y })

  const sheet = sheets.find((item) => item.id === sheetId)
  const currentColor = sheet?.color ?? null

  function reserveUniqueName(proposedName: string): string {
    const existing = new Set(sheets.map((item) => item.name.toLowerCase()))
    const baseName = proposedName.trim() || 'Sheet'
    let candidate = baseName
    let suffix = 2

    while (existing.has(candidate.toLowerCase())) {
      candidate = `${baseName} (${suffix})`
      suffix += 1
    }

    return candidate
  }

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const margin = 8
    const rect = menu.getBoundingClientRect()
    const nextLeft = Math.min(
      Math.max(x, margin),
      Math.max(margin, window.innerWidth - rect.width - margin)
    )
    const nextTop = Math.min(
      Math.max(y, margin),
      Math.max(margin, window.innerHeight - rect.height - margin)
    )

    setPosition((current) =>
      current.left === nextLeft && current.top === nextTop
        ? current
        : { left: nextLeft, top: nextTop }
    )
  }, [showColorPicker, x, y])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  function handleAction(action: SheetContextMenuAction) {
    switch (action) {
      case 'rename': {
        const current = sheet?.name ?? 'Sheet'
        onClose()
        void (async () => {
          const { promptDialog } = await import('@/components/PromptDialog')
          const newName = await promptDialog({
            title: 'Rename sheet',
            defaultValue: current,
            placeholder: 'New sheet name',
          })
          if (newName && newName.trim()) renameSheet(sheetId, newName.trim())
        })()
        break
      }
      case 'duplicate': {
        if (!sheet) {
          onClose()
          break
        }

        const orderedSheets = [...sheets].sort((left, right) => left.order - right.order)
        const sourceIndex = orderedSheets.findIndex((item) => item.id === sheetId)
        if (sourceIndex === -1) {
          onClose()
          break
        }

        const nextSheetId = createSheetId()
        const nextSheetName = reserveUniqueName(`${sheet.name} Copy`)
        const duplicatedTab = {
          ...sheet,
          id: nextSheetId,
          name: nextSheetName,
          isHidden: false,
        }

        const nextWorkbookSheets = [...orderedSheets]
        nextWorkbookSheets.splice(sourceIndex + 1, 0, duplicatedTab)

        const normalizedWorkbookSheets = nextWorkbookSheets.map((item, index) => ({
          ...item,
          order: index,
        }))

        const gridSheetMap = new Map(
          gridSheets
            .filter((item) => typeof item.id === 'string')
            .map((item) => [item.id as string, item])
        )
        const sourceGridSheet = gridSheetMap.get(sheetId)
        const duplicatedGridSheet: Sheet = cloneFortuneData(
          sourceGridSheet ?? createDefaultSheet(sheet.name, sheetId)
        )

        const nextGridSheets = normalizedWorkbookSheets.map((tabSheet) => {
          if (tabSheet.id === nextSheetId) {
            return {
              ...duplicatedGridSheet,
              id: nextSheetId,
              name: nextSheetName,
              order: tabSheet.order,
              status: 1 as const,
              hide: 0,
              ...(tabSheet.color ? { color: tabSheet.color } : {}),
            }
          }

          const existingGridSheet = gridSheetMap.get(tabSheet.id)
          const baseSheet = cloneFortuneData(
            existingGridSheet ?? createDefaultSheet(tabSheet.name, tabSheet.id)
          )

          return {
            ...baseSheet,
            id: tabSheet.id,
            name: tabSheet.name,
            order: tabSheet.order,
            status: tabSheet.id === nextSheetId ? (1 as const) : (0 as const),
            hide: tabSheet.isHidden ? 1 : 0,
            ...(tabSheet.color ? { color: tabSheet.color } : {}),
          }
        })

        setSkipNextTabSync(true)
        replaceSheets(normalizedWorkbookSheets, nextSheetId)
        replaceGridSheets(nextGridSheets)
        onClose()
        break
      }
      case 'delete':
        if (sheets.length <= 1) {
          window.alert('Cannot delete the only sheet.')
          onClose()
          break
        }
        if (window.confirm(`Delete "${sheet?.name ?? 'sheet'}"?`)) {
          removeSheet(sheetId)
        }
        onClose()
        break
      case 'hide':
        hideSheet(sheetId)
        onClose()
        break
      case 'move_left':
        moveSheet(sheetId, 'left')
        onClose()
        break
      case 'move_right':
        moveSheet(sheetId, 'right')
        onClose()
        break
      case 'color':
        setShowColorPicker((visible) => !visible)
        break
    }
  }

  function handleColorChange(color: string | null) {
    setSheetColor(sheetId, color)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
      className="min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
    >
      {MENU_ITEMS.map((item) => (
        <button
          key={item.action}
          type="button"
          onClick={() => handleAction(item.action)}
          className={`w-full px-4 py-1.5 text-left text-xs transition-colors hover:bg-zinc-50 ${
            item.danger ? 'text-red-500 hover:text-red-700' : 'text-zinc-700'
          }`}
        >
          {item.label}
        </button>
      ))}

      {showColorPicker && (
        <div className="border-t border-zinc-100 pt-1">
          <SheetColorPicker currentColor={currentColor} onChange={handleColorChange} />
        </div>
      )}
    </div>
  )
}
