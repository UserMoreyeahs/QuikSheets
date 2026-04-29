'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getCellDisplayValue, getCellFromSheet } from '@/lib/fortuneSheet'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'
import { ToolbarButton } from './ToolbarButton'
import { ToolbarSeparator } from './ToolbarSeparator'
import { ColorPicker } from './ColorPicker'
import { FontSizeSelector } from './FontSizeSelector'
import { FontFamilySelector } from './FontFamilySelector'
import { NumberFormatSelector } from './NumberFormatSelector'
import type { FontFamily, NumberFormat } from '@/types/sheet.types'
import type { Sheet } from '@fortune-sheet/core'

interface FormattingToolbarProps {
  onSortAsc?: () => void
  onSortDesc?: () => void
  onFilter?: () => void
}

interface FortuneSelectionRange {
  row: [number, number]
  column: [number, number]
}

interface MergeCapableWorkbook {
  mergeCells?: (ranges: FortuneSelectionRange[], type: string, options?: { id?: string }) => void
  cancelMerge?: (ranges: FortuneSelectionRange[], options?: { id?: string }) => void
}

type MergeAction = 'merge-all' | 'merge-horizontal' | 'merge-vertical' | 'unmerge'

const MERGE_ACTIONS: Array<{ action: MergeAction; label: string; shortcut?: string }> = [
  { action: 'merge-all', label: 'Merge all', shortcut: 'Ctrl+Shift+M' },
  { action: 'merge-horizontal', label: 'Merge horizontally' },
  { action: 'merge-vertical', label: 'Merge vertically' },
  { action: 'unmerge', label: 'Unmerge', shortcut: 'Ctrl+Shift+U' },
]

function normalizeSelectionBounds(
  selectedCell: { row: number; col: number } | null,
  selectedRange:
    | {
        start: { row: number; col: number }
        end: { row: number; col: number }
      }
    | null
): FortuneSelectionRange | null {
  if (!selectedCell) return null

  if (!selectedRange) {
    return {
      row: [selectedCell.row, selectedCell.row],
      column: [selectedCell.col, selectedCell.col],
    }
  }

  return {
    row: [
      Math.min(selectedRange.start.row, selectedRange.end.row),
      Math.max(selectedRange.start.row, selectedRange.end.row),
    ],
    column: [
      Math.min(selectedRange.start.col, selectedRange.end.col),
      Math.max(selectedRange.start.col, selectedRange.end.col),
    ],
  }
}

function getMergeRangeFromCell(
  selectedSheet: Sheet,
  row: number,
  col: number
): FortuneSelectionRange | null {
  const cell = getCellFromSheet(selectedSheet, row, col)
  const mergeInfo = cell?.mc
  if (!mergeInfo) return null

  const topRow = mergeInfo.r
  const topCol = mergeInfo.c
  const topCell = getCellFromSheet(selectedSheet, topRow, topCol)
  const topMerge = topCell?.mc ?? mergeInfo
  const rowSpan = Math.max(topMerge.rs ?? 1, 1)
  const colSpan = Math.max(topMerge.cs ?? 1, 1)

  return {
    row: [topRow, topRow + rowSpan - 1],
    column: [topCol, topCol + colSpan - 1],
  }
}

function hasNonEmptyMergeLoss(
  selectedSheet: Sheet | null,
  selectionBounds: FortuneSelectionRange,
  action: Exclude<MergeAction, 'unmerge'>
): number {
  if (!selectedSheet) return 0

  let nonEmptyCells = 0
  for (let row = selectionBounds.row[0]; row <= selectionBounds.row[1]; row += 1) {
    for (let col = selectionBounds.column[0]; col <= selectionBounds.column[1]; col += 1) {
      const keepsValue =
        action === 'merge-all'
          ? row === selectionBounds.row[0] && col === selectionBounds.column[0]
          : action === 'merge-horizontal'
            ? col === selectionBounds.column[0]
            : row === selectionBounds.row[0]
      if (keepsValue) continue

      const value = getCellDisplayValue(getCellFromSheet(selectedSheet, row, col))
      if (value !== null && value !== '') {
        nonEmptyCells += 1
      }
    }
  }

  return nonEmptyCells
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return (
    element?.tagName === 'INPUT' ||
    element?.tagName === 'TEXTAREA' ||
    element?.isContentEditable === true
  )
}

export function FormattingToolbar({ onSortAsc, onSortDesc, onFilter }: FormattingToolbarProps) {
  const [isMergeMenuOpen, setIsMergeMenuOpen] = useState(false)
  const [mergeMenuRect, setMergeMenuRect] = useState<DOMRect | null>(null)
  const mergeAnchorRef = useRef<HTMLDivElement>(null)
  const mergeMenuRef = useRef<HTMLDivElement>(null)
  const {
    activeFormatting,
    activeFilters,
    applyFormatToSelection,
    clearFormatOnSelection,
    gridInstance,
    gridSheets,
    selectedCell,
    selectedRange,
    setShowFindReplace,
  } = useSheetStore()

  const toggle = useCallback(
    (key: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'wrapText') => {
      applyFormatToSelection({ [key]: !activeFormatting[key] })
    },
    [activeFormatting, applyFormatToSelection]
  )

  const selectionBounds = normalizeSelectionBounds(selectedCell, selectedRange)
  const selectedSheet =
    selectedCell && selectedCell.sheet >= 0 ? (gridSheets[selectedCell.sheet] ?? null) : null
  const selectedSheetId =
    typeof selectedSheet?.id === 'string' ? (selectedSheet.id as string) : undefined
  const selectedSheetCell =
    selectedSheet && selectedCell
      ? getCellFromSheet(selectedSheet, selectedCell.row, selectedCell.col)
      : null
  const mergeInfo = selectedSheetCell?.mc
  const mergeRange =
    selectedSheet && selectedCell
      ? getMergeRangeFromCell(selectedSheet, selectedCell.row, selectedCell.col)
      : null
  const selectionSpansMultipleCells = selectionBounds
    ? selectionBounds.row[0] !== selectionBounds.row[1] ||
      selectionBounds.column[0] !== selectionBounds.column[1]
    : false
  const canMergeSelection = Boolean(gridInstance && selectionBounds && selectionSpansMultipleCells)
  const canUnmergeSelection = Boolean(gridInstance && mergeRange)
  const canOpenMergeMenu = Boolean(gridInstance && selectionBounds && (canMergeSelection || canUnmergeSelection))

  const handleMergeAction = useCallback((action: MergeAction) => {
    if (!selectionBounds || !gridInstance) return

    const workbook = gridInstance as unknown as MergeCapableWorkbook
    const options = selectedSheetId ? { id: selectedSheetId } : undefined

    if (action === 'unmerge') {
      workbook.cancelMerge?.([mergeRange ?? selectionBounds], options)
      setIsMergeMenuOpen(false)
      return
    }

    if (!selectionSpansMultipleCells) return

    const losingCells = hasNonEmptyMergeLoss(selectedSheet, selectionBounds, action)
    if (
      losingCells > 0 &&
      !window.confirm(
        `Merging will keep only the top-left cell value. ${losingCells} other cell${
          losingCells === 1 ? '' : 's'
        } will lose their content. Continue?`
      )
    ) {
      return
    }

    workbook.mergeCells?.([selectionBounds], action, options)
    applyFormatToSelection({ textAlign: 'center', verticalAlign: 'middle' })
    setIsMergeMenuOpen(false)
  }, [
    applyFormatToSelection,
    gridInstance,
    mergeRange,
    selectedSheet,
    selectedSheetId,
    selectionBounds,
    selectionSpansMultipleCells,
  ])

  const openMergeMenu = useCallback(() => {
    if (!canOpenMergeMenu) return
    const rect = mergeAnchorRef.current?.getBoundingClientRect() ?? null
    setMergeMenuRect(rect)
    setIsMergeMenuOpen((open) => !open)
  }, [canOpenMergeMenu])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mergeMenuRef.current?.contains(event.target as Node) ||
        mergeAnchorRef.current?.contains(event.target as Node)
      ) {
        return
      }
      setIsMergeMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (!event.ctrlKey || !event.shiftKey) return

      if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        handleMergeAction('merge-all')
      }

      if (event.key.toLowerCase() === 'u') {
        event.preventDefault()
        handleMergeAction('unmerge')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMergeAction])

  return (
    <div className="flex h-10 w-full shrink-0 items-center gap-0.5 overflow-x-auto border-b border-zinc-200 bg-white px-2 scrollbar-none dark:border-zinc-700 dark:bg-zinc-800">
      <NumberFormatSelector
        value={activeFormatting.numberFormat}
        onChange={(f: NumberFormat) => applyFormatToSelection({ numberFormat: f })}
      />

      <ToolbarSeparator />

      <FontFamilySelector
        value={activeFormatting.fontFamily}
        onChange={(f: FontFamily) => applyFormatToSelection({ fontFamily: f })}
      />

      <div className="mx-1" />

      <FontSizeSelector
        value={activeFormatting.fontSize}
        onChange={(s) => applyFormatToSelection({ fontSize: s })}
      />

      <ToolbarSeparator />

      <ToolbarButton onClick={() => toggle('bold')} isActive={activeFormatting.bold} title="Bold (Ctrl+B)">
        <span className="text-sm font-bold">B</span>
      </ToolbarButton>

      <ToolbarButton onClick={() => toggle('italic')} isActive={activeFormatting.italic} title="Italic (Ctrl+I)">
        <span className="text-sm italic">I</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => toggle('underline')}
        isActive={activeFormatting.underline}
        title="Underline (Ctrl+U)"
      >
        <span className="text-sm underline">U</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => toggle('strikethrough')}
        isActive={activeFormatting.strikethrough}
        title="Strikethrough"
      >
        <span className="text-sm line-through">S</span>
      </ToolbarButton>

      <ToolbarSeparator />

      <ColorPicker
        value={activeFormatting.textColor}
        onChange={(c) => applyFormatToSelection({ textColor: c })}
        label="Text color"
        trigger={
          <span className="text-sm font-bold" style={{ color: activeFormatting.textColor }}>
            A
          </span>
        }
      />

      <ColorPicker
        value={activeFormatting.backgroundColor}
        onChange={(c) => applyFormatToSelection({ backgroundColor: c })}
        label="Fill color"
        trigger={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={activeFormatting.backgroundColor}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M20 14c.5.5.5 1.5 0 2L14 22l-2-2 6-6z" />
            <path d="M4 4l9 9-4 4L2 10z" />
            <path d="M2 22h4" />
          </svg>
        }
      />

      <ToolbarSeparator />

      <ToolbarButton
        onClick={() => applyFormatToSelection({ textAlign: 'left' })}
        isActive={activeFormatting.textAlign === 'left'}
        title="Align left"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => applyFormatToSelection({ textAlign: 'center' })}
        isActive={activeFormatting.textAlign === 'center'}
        title="Align center"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => applyFormatToSelection({ textAlign: 'right' })}
        isActive={activeFormatting.textAlign === 'right'}
        title="Align right"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="9" y1="12" x2="21" y2="12" />
          <line x1="6" y1="18" x2="21" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        onClick={() => applyFormatToSelection({ verticalAlign: 'top' })}
        isActive={activeFormatting.verticalAlign === 'top'}
        title="Align top"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="3" x2="21" y2="3" />
          <line x1="12" y1="7" x2="12" y2="21" />
          <line x1="8" y1="11" x2="12" y2="7" />
          <line x1="16" y1="11" x2="12" y2="7" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => applyFormatToSelection({ verticalAlign: 'middle' })}
        isActive={activeFormatting.verticalAlign === 'middle'}
        title="Align middle"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="21" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => applyFormatToSelection({ verticalAlign: 'bottom' })}
        isActive={activeFormatting.verticalAlign === 'bottom'}
        title="Align bottom"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="21" x2="21" y2="21" />
          <line x1="12" y1="3" x2="12" y2="17" />
          <line x1="8" y1="13" x2="12" y2="17" />
          <line x1="16" y1="13" x2="12" y2="17" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton onClick={() => toggle('wrapText')} isActive={activeFormatting.wrapText} title="Wrap text">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M3 12h15a3 3 0 0 1 0 6h-4" />
          <polyline points="14 15 11 18 14 21" />
          <line x1="3" y1="18" x2="7" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton disabled title="Borders are still unavailable in this build">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      <div ref={mergeAnchorRef} className="flex items-center">
        <ToolbarButton
          onClick={() => handleMergeAction(mergeInfo ? 'unmerge' : 'merge-all')}
          disabled={mergeInfo ? !canUnmergeSelection : !canMergeSelection}
          title={mergeInfo ? 'Unmerge cells (Ctrl+Shift+U)' : 'Merge all (Ctrl+Shift+M)'}
          className="rounded-r-none"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" />
            <line x1="12" y1="6" x2="12" y2="18" />
            <polyline points="8 10 12 6 16 10" />
            <polyline points="8 14 12 18 16 14" />
          </svg>
        </ToolbarButton>
        <button
          type="button"
          onClick={openMergeMenu}
          disabled={!canOpenMergeMenu}
          title="Merge options"
          className={cn(
            'flex h-7 w-5 items-center justify-center rounded-r text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900',
            !canOpenMergeMenu && 'cursor-not-allowed opacity-30'
          )}
        >
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {isMergeMenuOpen && mergeMenuRect && (
        <div
          ref={mergeMenuRef}
          style={{
            position: 'fixed',
            top: mergeMenuRect.bottom + 2,
            left: mergeMenuRect.left,
            width: 210,
            zIndex: 9999,
          }}
          className="overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
        >
          {MERGE_ACTIONS.map((item) => {
            const disabled =
              item.action === 'unmerge' ? !canUnmergeSelection : !canMergeSelection
            return (
              <button
                key={item.action}
                type="button"
                disabled={disabled}
                onClick={() => handleMergeAction(item.action)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition-colors',
                  disabled
                    ? 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700'
                )}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="font-mono text-[10px] text-zinc-400">{item.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <ToolbarSeparator />

      <ToolbarButton onClick={clearFormatOnSelection} title="Clear formatting">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
          <line x1="18" y1="9" x2="12" y2="15" />
          <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton onClick={() => onSortAsc?.()} title="Sort A to Z">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="14" y2="6" />
          <line x1="3" y1="12" x2="11" y2="12" />
          <line x1="3" y1="18" x2="8" y2="18" />
          <polyline points="17 15 20 18 23 15" />
          <line x1="20" y1="6" x2="20" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarButton onClick={() => onSortDesc?.()} title="Sort Z to A">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="14" y2="6" />
          <line x1="3" y1="12" x2="11" y2="12" />
          <line x1="3" y1="18" x2="8" y2="18" />
          <polyline points="17 9 20 6 23 9" />
          <line x1="20" y1="6" x2="20" y2="18" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => onFilter?.()}
        isActive={activeFilters.length > 0}
        title={activeFilters.length > 0 ? `${activeFilters.length} filter(s) active` : 'Add filter'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </ToolbarButton>

      <ToolbarButton onClick={() => setShowFindReplace(true)} title="Find & Replace (Ctrl+F)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </ToolbarButton>
    </div>
  )
}
