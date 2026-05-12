'use client'

/**
 * AppMenuBar
 * Classic text-based menu bar: File | Edit | View | Insert | Format | Data | ✦ AI | Help
 * Every item is wired to a real action — no stubs.
 */

import { Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSheetStore } from '@/store/sheetStore'
import type { RibbonHandlers } from './Ribbon'

const TRIGGER =
  'flex h-full cursor-default items-center rounded px-2.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 select-none'

export function AppMenuBar({ handlers }: { handlers: RibbonHandlers }) {
  const { gridInstance, activeFormatting, applyFormatToSelection } =
    useSheetStore()
  const handleUndo = () => gridInstance?.handleUndo()
  const handleRedo = () => gridInstance?.handleRedo()

  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
      {/* ── File ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mr-1 flex h-6 cursor-default items-center self-center rounded-sm bg-emerald-600 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 select-none"
          >
            File
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={() => handlers.onNewWorkbook?.()}>
            New workbook
            <DropdownMenuShortcut>Ctrl+Alt+N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onOpenDashboard?.()}>
            Open dashboard…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onSaveNow?.()}>
            Save
            <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onImport?.()}>
            Import CSV / Excel…
          </DropdownMenuItem>
          <DropdownMenuLabel className="pb-0 text-[10px] uppercase tracking-wider text-zinc-400">
            Download
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => handlers.onExportCSV?.()}>
            Comma-separated values (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onExportXLSX?.()}>
            Microsoft Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onExportPDF?.()}>
            PDF document (.pdf)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onShareLink?.()}>
            Share…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onVersionHistory?.()}>
            Version history…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Edit ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TRIGGER}>
            Edit
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem disabled={!gridInstance} onSelect={handleUndo}>
            Undo
            <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!gridInstance} onSelect={handleRedo}>
            Redo
            <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onFind()}>
            Find &amp; Replace
            <DropdownMenuShortcut>Ctrl+F</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onInsertRow?.()}>
            Insert row below
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onDeleteRow?.()}>
            Delete row
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onClearFormatting()}>
            Clear formatting
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── View ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TRIGGER}>
            View
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuCheckboxItem
            checked={handlers.formulaBarVisible ?? true}
            onCheckedChange={() => handlers.onToggleFormulaBar?.()}
          >
            Formula Bar
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={handlers.gridlinesVisible ?? true}
            onCheckedChange={() => handlers.onToggleGridlines?.()}
          >
            Gridlines
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onZoomIn?.()}>
            Zoom in
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onZoomOut?.()}>
            Zoom out
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onZoomReset?.()}>
            Reset to 100%
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onMapView()}>
            Dependency Map
            <DropdownMenuShortcut>Ctrl+M</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onShortcuts()}>
            Keyboard shortcuts
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Insert ───────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TRIGGER}>
            Insert
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={() => handlers.onInsertSheet()}>
            New Sheet
            <DropdownMenuShortcut>Shift+F11</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onInsertRow?.()}>
            Insert row below
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onDeleteRow?.()}>
            Delete row
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onInsertChart?.()}>
            Chart…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onInsertPivot?.()}>
            Pivot Table…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onInsertForm?.()}>
            Form from sheet…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onValidation()}>
            Data Validation…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Format ───────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TRIGGER}>
            Format
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem
            onSelect={() => applyFormatToSelection({ bold: !activeFormatting.bold })}
          >
            Bold
            <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => applyFormatToSelection({ italic: !activeFormatting.italic })}
          >
            Italic
            <DropdownMenuShortcut>Ctrl+I</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => applyFormatToSelection({ underline: !activeFormatting.underline })}
          >
            Underline
            <DropdownMenuShortcut>Ctrl+U</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              applyFormatToSelection({ strikethrough: !activeFormatting.strikethrough })
            }
          >
            Strikethrough
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onMergeCells()}>
            Merge cells
            <DropdownMenuShortcut>Ctrl+Shift+M</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onUnmergeCells()}>
            Unmerge
            <DropdownMenuShortcut>Ctrl+Shift+U</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onClearFormatting()}>
            Clear formatting
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onConditionalFormatting()}>
            Conditional Formatting…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onProtectedRanges?.()}>
            Protected Ranges…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Data ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TRIGGER}>
            Data
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={() => handlers.onSortAsc()}>Sort A → Z</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onSortDesc()}>Sort Z → A</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onFilter()}>Filter</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onValidation()}>
            Data Validation…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onDedupe?.()}>
            Remove Duplicates
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onImport?.()}>
            Import CSV / Excel…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── ✦ AI — Quiksheets differentiator ─────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-full cursor-default items-center gap-1 rounded px-2.5 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20 select-none"
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-[12px] font-semibold text-transparent dark:from-amber-400 dark:to-orange-400">
              AI
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem onSelect={() => handlers.onAIAssistant()}>
            <span className="mr-1.5 text-amber-500">✦</span>
            AI Formula Assistant
            <DropdownMenuShortcut>=?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onRowSummarizer?.()}>
            <span className="mr-1.5 text-violet-500">✦</span>
            AI Row Summarise
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onColumnDNA?.()}>
            <span className="mr-1.5 text-cyan-500">✦</span>
            Column DNA Analysis
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onCleanData?.()}>
            <span className="mr-1.5 text-rose-500">✦</span>
            Clean Data…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onForecast?.()}>
            <span className="mr-1.5 text-emerald-500">✦</span>
            Forecasting Agent…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onMapView()}>
            <span className="mr-1.5 text-emerald-500">✦</span>
            Dependency Map
            <DropdownMenuShortcut>Ctrl+M</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-[11px] italic text-zinc-400 dark:text-zinc-500">
            Hover any formula cell for AI explanation
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Review ───────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TRIGGER}>
            Review
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={() => handlers.onComments?.()}>
            Comments panel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onVersionHistory?.()}>
            Version history…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handlers.onProtectedRanges?.()}>
            Protected ranges…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onShareLink?.()}>
            Share workbook…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Help ─────────────────────────────────────────── */}
      <div className="ml-auto flex items-center">
        <button
          type="button"
          onClick={() => handlers.onShortcuts()}
          className={TRIGGER}
        >
          Help
        </button>
      </div>
    </div>
  )
}
