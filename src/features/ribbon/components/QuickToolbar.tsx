'use client'

/**
 * QuickToolbar
 * Excel-style ribbon toolbar matching Microsoft Excel's Home tab layout.
 *
 *   ┌──────┬─────────────────────┬──────────────────┬──────────┬─────────┬──────────────────┐
 *   │ Hist │ Font  (2 rows)      │ Align (mix)      │ Number   │ Styles  │ Editing (mix)    │
 *   └──────┴─────────────────────┴──────────────────┴──────────┴─────────┴──────────────────┘
 *      └ each section has a small uppercase label pinned at the very bottom ┘
 *
 * • Small icon buttons (22×22) for high-frequency toggles (B / I / U / Align / $ / %).
 * • Big icon-on-top + label-below buttons (60×58) for prominent actions
 *   (Wrap, Merge, Conditional Formatting, AutoSum, Sort & Filter, Find).
 * • shadcn Tooltips with shortcut chips, gradient AI Formula CTA on the right.
 */

import { type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownUp,
  BarChart3,
  Bold,
  ChevronDown,
  DollarSign,
  Eraser,
  Filter,
  Italic,
  Merge as MergeIcon,
  Percent,
  Redo2,
  Search,
  Sigma,
  SortAsc,
  Sparkles,
  Strikethrough,
  Table as TableIcon,
  Table2,
  Underline,
  Undo2,
  WrapText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'
import { FontFamilySelector } from '@/features/toolbar/components/FontFamilySelector'
import { FontSizeSelector } from '@/features/toolbar/components/FontSizeSelector'
import { NumberFormatSelector } from '@/features/toolbar/components/NumberFormatSelector'
import { ColorPicker } from '@/features/toolbar/components/ColorPicker'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FontFamily, NumberFormat } from '@/types/sheet.types'
import type { RibbonHandlers } from './Ribbon'

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Small icon button (22×22) — for fast toggles */
function SmallBtn({
  tip,
  shortcut,
  icon,
  active = false,
  disabled = false,
  badge = false,
  onClick,
}: {
  tip: string
  shortcut?: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  badge?: boolean
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={tip}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            active
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60',
            disabled && 'cursor-not-allowed opacity-30',
          )}
        >
          {icon}
          {badge && (
            <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2 text-[12px]" sideOffset={6}>
        <span>{tip}</span>
        {shortcut && (
          <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** Large button: icon on top + label underneath — for prominent actions */
function BigBtn({
  tip,
  shortcut,
  icon,
  label,
  active = false,
  hasDropdown = false,
  badge = false,
  onClick,
}: {
  tip: string
  shortcut?: string
  icon: ReactNode
  label: string
  active?: boolean
  hasDropdown?: boolean
  badge?: boolean
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={tip}
          onClick={onClick}
          className={cn(
            'relative flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded px-1 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            active
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60',
          )}
        >
          <div className="flex h-5 items-center">{icon}</div>
          <div className="flex max-w-full items-center gap-0.5 leading-none">
            <span className="truncate text-[10px]">{label}</span>
            {hasDropdown && <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />}
          </div>
          {badge && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2 text-[12px]" sideOffset={6}>
        <span>{tip}</span>
        {shortcut && (
          <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** Slim vertical divider between sub-groups within the same group */
function VLine() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
}

/** Excel-style group container with section label pinned at the bottom */
function ToolGroup({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col border-r border-zinc-200 px-2 dark:border-zinc-700',
        className,
      )}
    >
      {/* button area — items are vertically centered */}
      <div className="flex flex-1 items-center gap-1 pt-1.5">{children}</div>
      {/* group caption pinned at bottom */}
      <p className="pb-1 pt-0.5 text-center text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function QuickToolbar({ handlers }: { handlers: RibbonHandlers }) {
  const {
    undo,
    redo,
    undoStack,
    redoStack,
    activeFormatting,
    activeFilters,
    applyFormatToSelection,
    clearFormatOnSelection,
  } = useSheetStore()

  const canUndo    = undoStack.length > 0
  const canRedo    = redoStack.length > 0
  const hasFilters = activeFilters.length > 0

  const toggle    = (k: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'wrapText') =>
    applyFormatToSelection({ [k]: !activeFormatting[k] })
  const setAlign   = (textAlign: 'left' | 'center' | 'right') => applyFormatToSelection({ textAlign })
  const setFamily  = (fontFamily: FontFamily)     => applyFormatToSelection({ fontFamily })
  const setSize    = (fontSize: number)           => applyFormatToSelection({ fontSize })
  const setFmt     = (numberFormat: NumberFormat) => applyFormatToSelection({ numberFormat })
  const setTColor  = (textColor: string)          => applyFormatToSelection({ textColor })
  const setBgColor = (backgroundColor: string)    => applyFormatToSelection({ backgroundColor })

  return (
    <div className="flex h-[88px] shrink-0 items-stretch overflow-x-auto border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">

      {/* ── History ─────────────────────────────────────────────────────────── */}
      <ToolGroup label="History">
        <div className="flex flex-col gap-1">
          <SmallBtn
            tip="Undo" shortcut="Ctrl+Z"
            icon={<Undo2 className="h-3.5 w-3.5" />}
            disabled={!canUndo}
            onClick={() => undo()}
          />
          <SmallBtn
            tip="Redo" shortcut="Ctrl+Y"
            icon={<Redo2 className="h-3.5 w-3.5" />}
            disabled={!canRedo}
            onClick={() => redo()}
          />
        </div>
      </ToolGroup>

      {/* ── Font ────────────────────────────────────────────────────────────── */}
      <ToolGroup label="Font">
        <div className="flex flex-col gap-1">
          {/* Row 1: family + size */}
          <div className="flex items-center gap-1">
            <FontFamilySelector value={activeFormatting.fontFamily} onChange={setFamily} />
            <FontSizeSelector value={activeFormatting.fontSize} onChange={setSize} />
          </div>
          {/* Row 2: B I U S | Fill | Text */}
          <div className="flex items-center gap-0.5">
            <SmallBtn tip="Bold" shortcut="Ctrl+B"
              icon={<Bold className="h-3.5 w-3.5" />}
              active={activeFormatting.bold}
              onClick={() => toggle('bold')} />
            <SmallBtn tip="Italic" shortcut="Ctrl+I"
              icon={<Italic className="h-3.5 w-3.5" />}
              active={activeFormatting.italic}
              onClick={() => toggle('italic')} />
            <SmallBtn tip="Underline" shortcut="Ctrl+U"
              icon={<Underline className="h-3.5 w-3.5" />}
              active={activeFormatting.underline}
              onClick={() => toggle('underline')} />
            <SmallBtn tip="Strikethrough"
              icon={<Strikethrough className="h-3.5 w-3.5" />}
              active={activeFormatting.strikethrough}
              onClick={() => toggle('strikethrough')} />
            <VLine />
            {/* Fill colour */}
            <ColorPicker
              value={activeFormatting.backgroundColor ?? '#ffff00'}
              onChange={setBgColor}
              label="Fill color"
              trigger={
                <span className="flex flex-col items-center">
                  <span className="text-[10px] font-bold leading-none text-zinc-700 dark:text-zinc-300">A</span>
                  <span
                    className="mt-[1px] block h-[3px] w-[12px] rounded-[1px]"
                    style={{ backgroundColor: activeFormatting.backgroundColor ?? '#ffff00' }}
                  />
                </span>
              }
            />
            {/* Text colour */}
            <ColorPicker
              value={activeFormatting.textColor ?? '#000000'}
              onChange={setTColor}
              label="Text color"
              trigger={
                <span className="flex flex-col items-center">
                  <span
                    className="text-[10px] font-bold leading-none"
                    style={{ color: activeFormatting.textColor ?? '#000000' }}
                  >
                    A
                  </span>
                  <span
                    className="mt-[1px] block h-[3px] w-[12px] rounded-[1px]"
                    style={{ backgroundColor: activeFormatting.textColor ?? '#000000' }}
                  />
                </span>
              }
            />
          </div>
        </div>
      </ToolGroup>

      {/* ── Alignment ───────────────────────────────────────────────────────── */}
      <ToolGroup label="Alignment">
        {/* small alignment toggles */}
        <div className="flex items-center gap-0.5">
          <SmallBtn tip="Align left"
            icon={<AlignLeft className="h-3.5 w-3.5" />}
            active={activeFormatting.textAlign === 'left'}
            onClick={() => setAlign('left')} />
          <SmallBtn tip="Align center"
            icon={<AlignCenter className="h-3.5 w-3.5" />}
            active={activeFormatting.textAlign === 'center'}
            onClick={() => setAlign('center')} />
          <SmallBtn tip="Align right"
            icon={<AlignRight className="h-3.5 w-3.5" />}
            active={activeFormatting.textAlign === 'right'}
            onClick={() => setAlign('right')} />
        </div>
        {/* big buttons: Wrap + Merge */}
        <BigBtn
          tip="Wrap text"
          icon={<WrapText className="h-4 w-4" />}
          label="Wrap"
          active={activeFormatting.wrapText}
          onClick={() => toggle('wrapText')}
        />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Merge / Unmerge cells"
                  className={cn(
                    'flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded px-1 transition-colors',
                    'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  )}
                >
                  <div className="flex h-5 items-center">
                    <MergeIcon className="h-4 w-4" />
                  </div>
                  <div className="flex max-w-full items-center gap-0.5 leading-none">
                    <span className="truncate text-[10px]">Merge</span>
                    <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />
                  </div>
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>Merge / Unmerge cells</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handlers.onMergeCells()}>Merge cells</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handlers.onUnmergeCells()}>Unmerge</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolGroup>

      {/* ── Number ──────────────────────────────────────────────────────────── */}
      <ToolGroup label="Number">
        <div className="flex flex-col gap-1">
          {/* Row 1: format dropdown */}
          <NumberFormatSelector
            value={activeFormatting.numberFormat ?? 'general'}
            onChange={setFmt}
          />
          {/* Row 2: $ % , */}
          <div className="flex items-center gap-0.5">
            <SmallBtn tip="Currency" shortcut="$"
              icon={<DollarSign className="h-3.5 w-3.5" />}
              active={activeFormatting.numberFormat === 'currency'}
              onClick={() => setFmt('currency')} />
            <SmallBtn tip="Percentage" shortcut="%"
              icon={<Percent className="h-3.5 w-3.5" />}
              active={activeFormatting.numberFormat === 'percentage'}
              onClick={() => setFmt('percentage')} />
            <SmallBtn tip="Comma style (1,000)"
              icon={<span className="text-[12px] font-semibold leading-none">,</span>}
              active={activeFormatting.numberFormat === 'number'}
              onClick={() => setFmt('number')} />
          </div>
        </div>
      </ToolGroup>

      {/* ── Styles ──────────────────────────────────────────────────────────── */}
      <ToolGroup label="Styles">
        <BigBtn
          tip="Conditional formatting"
          icon={<Table2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          label="Format"
          onClick={() => handlers.onConditionalFormatting()}
        />
      </ToolGroup>

      {/* ── Insert ──────────────────────────────────────────────────────────── */}
      <ToolGroup label="Insert">
        <BigBtn
          tip="Insert Chart"
          icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
          label="Chart"
          onClick={() => handlers.onInsertChart?.()}
        />
        <BigBtn
          tip="Insert Pivot Table"
          icon={<TableIcon className="h-4 w-4 text-violet-500" />}
          label="Pivot"
          onClick={() => handlers.onInsertPivot?.()}
        />
      </ToolGroup>

      {/* ── Editing ─────────────────────────────────────────────────────────── */}
      <ToolGroup label="Editing">
        <BigBtn
          tip="AutoSum — insert SUM formula"
          icon={<Sigma className="h-4 w-4 text-orange-500" />}
          label="AutoSum"
          onClick={() => handlers.onAutoSum?.()}
        />
        {/* Sort & Filter dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Sort and filter"
                  className={cn(
                    'relative flex h-[58px] w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded px-1 transition-colors',
                    'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                  )}
                >
                  <div className="flex h-5 items-center">
                    <ArrowDownUp className="h-4 w-4" />
                  </div>
                  <div className="flex max-w-full items-center gap-0.5 leading-none">
                    <span className="truncate text-[10px]">Sort</span>
                    <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />
                  </div>
                  {hasFilters && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>Sort &amp; Filter</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handlers.onSortAsc()}>
              <SortAsc className="mr-2 h-4 w-4" /> Sort A → Z
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handlers.onSortDesc()}>
              <SortAsc className="mr-2 h-4 w-4 rotate-180" /> Sort Z → A
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handlers.onFilter()}>
              <Filter className="mr-2 h-4 w-4" /> Toggle filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <BigBtn
          tip="Find &amp; Replace"
          shortcut="Ctrl+F"
          icon={<Search className="h-4 w-4" />}
          label="Find"
          onClick={() => handlers.onFind()}
        />
        {/* Clear formatting — small button at the end */}
        <div className="flex flex-col items-center justify-center self-stretch py-1">
          <SmallBtn
            tip="Clear formatting"
            icon={<Eraser className="h-3.5 w-3.5" />}
            onClick={() => clearFormatOnSelection()}
          />
        </div>
      </ToolGroup>

      {/* ── Spacer ──────────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── AI Formula CTA ──────────────────────────────────────────────────── */}
      <div className="flex items-center pr-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handlers.onAIAssistant()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              AI Formula
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            AI Formula Assistant — type{' '}
            <kbd className="mx-0.5 rounded bg-zinc-200 px-1 font-mono text-[10px] dark:bg-zinc-700">=?</kbd>{' '}
            in any cell
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
