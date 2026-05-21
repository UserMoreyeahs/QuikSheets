'use client'

/**
 * UX-2 — Excel-grade right-click cell context menu.
 *
 * Replaces the old 3-item menu (AI summarise, Comment, History) with a
 * full Excel-faithful set: Cut/Copy/Paste, Insert/Delete row + column,
 * Clear contents, Format cells (opens Home tab Number group), Hyperlink,
 * Define name, plus the existing power-tool entries at the bottom.
 *
 * The component is intentionally presentational — it receives callbacks
 * and the menu state from SpreadsheetGrid which owns selection + the
 * gridInstance ref. Keeping the rendering split out makes the menu easy
 * to test and to extend without bloating SpreadsheetGrid.
 */

import { forwardRef, type ReactNode } from 'react'
import {
  Sparkles,
  MessageSquare,
  History as HistoryIcon,
  Scissors,
  Copy,
  ClipboardPaste,
  ClipboardCopy,
  Eraser,
  Plus,
  Trash2,
  Link2,
  Tag,
  Type,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'

interface MenuItem {
  label: string
  icon?: ReactNode
  shortcut?: string
  onClick?: (() => void) | undefined
  disabled?: boolean
}

interface MenuSubmenu {
  label: string
  icon?: ReactNode
  items: MenuItem[]
}

export interface CellContextMenuProps {
  left: number
  top: number
  /** Cut selection to clipboard. */
  onCut?: (() => void) | undefined
  /** Copy selection to clipboard. */
  onCopy?: (() => void) | undefined
  /** Paste from clipboard (values + formatting). */
  onPaste?: (() => void) | undefined
  /** Paste values only. */
  onPasteValues?: (() => void) | undefined
  /** Insert row above the active cell. */
  onInsertRowAbove?: (() => void) | undefined
  /** Insert row below the active cell. */
  onInsertRowBelow?: (() => void) | undefined
  /** Insert column to the left of the active cell. */
  onInsertColLeft?: (() => void) | undefined
  /** Insert column to the right of the active cell. */
  onInsertColRight?: (() => void) | undefined
  /** Delete the active row. */
  onDeleteRow?: (() => void) | undefined
  /** Delete the active column. */
  onDeleteCol?: (() => void) | undefined
  /** Clear contents of the active cell. */
  onClearContents?: (() => void) | undefined
  /** Open Format Cells dialog / focus Number Format dropdown. */
  onFormatCells?: (() => void) | undefined
  /** Insert hyperlink. */
  onInsertHyperlink?: (() => void) | undefined
  /** Define a name for the active cell / range. */
  onDefineName?: (() => void) | undefined
  /** Add a threaded comment (kept from legacy menu). */
  onAddComment?: (() => void) | undefined
  /** View cell history (kept from legacy menu). */
  onViewCellHistory?: (() => void) | undefined
  /** AI summarise N selected rows (visible only when row selection active). */
  onSummarizeRows?: (() => void) | undefined
  /** True when the click originated from a multi-row selection. */
  hasRowSelection?: boolean
}

export const CellContextMenu = forwardRef<HTMLDivElement, CellContextMenuProps>(function CellContextMenu(
  props,
  ref,
) {
  const insertSubmenu: MenuSubmenu = {
    label: 'Insert',
    icon: <Plus className="h-3.5 w-3.5" />,
    items: [
      { label: 'Row above',     icon: <ArrowUp className="h-3.5 w-3.5" />,    onClick: () => props.onInsertRowAbove?.() },
      { label: 'Row below',     icon: <ArrowDown className="h-3.5 w-3.5" />,  onClick: () => props.onInsertRowBelow?.() },
      { label: 'Column left',   icon: <ArrowLeft className="h-3.5 w-3.5" />,  onClick: () => props.onInsertColLeft?.() },
      { label: 'Column right',  icon: <ArrowRight className="h-3.5 w-3.5" />, onClick: () => props.onInsertColRight?.() },
    ],
  }

  const deleteSubmenu: MenuSubmenu = {
    label: 'Delete',
    icon: <Trash2 className="h-3.5 w-3.5" />,
    items: [
      { label: 'Row',    icon: <ArrowUp className="h-3.5 w-3.5" />,   onClick: () => props.onDeleteRow?.() },
      { label: 'Column', icon: <ArrowLeft className="h-3.5 w-3.5" />, onClick: () => props.onDeleteCol?.() },
    ],
  }

  return (
    <div
      ref={ref}
      style={{ left: props.left, top: props.top }}
      className="fixed z-[70] min-w-[220px] rounded-md border border-zinc-200 bg-white py-1 text-zinc-700 shadow-xl dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      role="menu"
    >
      <Row label="Cut"            icon={<Scissors className="h-3.5 w-3.5" />}       shortcut="Ctrl+X" onClick={props.onCut} />
      <Row label="Copy"           icon={<Copy className="h-3.5 w-3.5" />}           shortcut="Ctrl+C" onClick={props.onCopy} />
      <Row label="Paste"          icon={<ClipboardPaste className="h-3.5 w-3.5" />} shortcut="Ctrl+V" onClick={props.onPaste} />
      <Row label="Paste values"   icon={<ClipboardCopy className="h-3.5 w-3.5" />}  onClick={props.onPasteValues} />

      <Separator />

      <Submenu submenu={insertSubmenu} />
      <Submenu submenu={deleteSubmenu} />
      <Row label="Clear contents" icon={<Eraser className="h-3.5 w-3.5" />} shortcut="Del" onClick={props.onClearContents} />

      <Separator />

      <Row label="Format cells…" icon={<Type className="h-3.5 w-3.5" />}  shortcut="Ctrl+1" onClick={props.onFormatCells} />
      <Row label="Hyperlink…"    icon={<Link2 className="h-3.5 w-3.5" />} shortcut="Ctrl+K" onClick={props.onInsertHyperlink} />
      <Row label="Define name…"  icon={<Tag className="h-3.5 w-3.5" />}   onClick={props.onDefineName} />

      <Separator />

      {props.hasRowSelection && props.onSummarizeRows && (
        <Row
          label="Summarise selected rows"
          icon={<Sparkles className="h-3.5 w-3.5 text-amber-500" />}
          shortcut="Alt+S"
          onClick={props.onSummarizeRows}
        />
      )}
      <Row label="Add comment"      icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={props.onAddComment} />
      <Row label="View cell history" icon={<HistoryIcon className="h-3.5 w-3.5" />} onClick={props.onViewCellHistory} />
    </div>
  )
})

function Row({ label, icon, shortcut, onClick, disabled }: MenuItem) {
  if (!onClick) return null
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-700"
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="shrink-0 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{shortcut}</span>
      )}
    </button>
  )
}

function Separator() {
  return <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-700" />
}

/**
 * Tiny CSS-only submenu — opens to the right on hover. Excel's
 * submenus open on click but hover is more discoverable here.
 */
function Submenu({ submenu }: { submenu: MenuSubmenu }) {
  return (
    <div className="group/sub relative">
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400">
          {submenu.icon}
        </span>
        <span className="flex-1">{submenu.label}</span>
        <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />
      </button>
      <div className="invisible absolute left-full top-0 -mt-1 ml-px min-w-[180px] rounded-md border border-zinc-200 bg-white py-1 shadow-xl group-hover/sub:visible dark:border-zinc-700 dark:bg-zinc-800">
        {submenu.items.map((item) => (
          <Row key={item.label} {...item} />
        ))}
      </div>
    </div>
  )
}
