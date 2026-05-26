'use client'

/**
 * Ribbon shell — Excel-style tabbed ribbon.
 *
 * Layout (top → bottom):
 *   1. RibbonTabBar  (File ▼ | Home | Insert | …)  — 28 px
 *   2. Tab content   (tool groups)                   — 80 px
 *
 * The green "File" button opens a dropdown backstage menu (New, Open, Save,
 * Import, Export, Share, Version History) — exactly like Excel.
 * All other tabs switch the ribbon content panel.
 *
 * Tab state is purely local UI — no global store needed.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HomeTab } from './HomeTab'
import {
  InsertTab,
  PageLayoutTab,
  FormulasTab,
  DataTab,
  ReviewTab,
  ViewTab,
  AutomateTab,
  HelpTab,
} from './OtherTabs'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RibbonTab =
  | 'home'
  | 'insert'
  | 'pageLayout'
  | 'formulas'
  | 'data'
  | 'review'
  | 'view'
  | 'automate'
  | 'help'

export interface RibbonHandlers {
  /** Workbook ID, used by features that need to scope to the current workbook (named ranges, etc.) */
  workbookId?: string

  // ── File backstage ──────────────────────────────────
  onNewWorkbook?: () => void
  onOpenDashboard?: () => void
  onSaveNow?: () => void
  onPrint?: () => void
  onImport?: () => void
  onExportCSV?: () => void
  onExportXLSX?: () => void
  onExportPDF?: () => void
  // ── Editing ─────────────────────────────────────────
  onSortAsc: () => void
  onSortDesc: () => void
  onCustomSort?: () => void
  onFilter: () => void
  onFind: () => void
  onConditionalFormatting: () => void
  onMergeCells: () => void
  onUnmergeCells: () => void
  onClearFormatting: () => void
  onValidation: () => void
  onAutoSum?: () => void
  onInsertRow?: () => void
  onDeleteRow?: () => void
  // ── Insert / AI ─────────────────────────────────────
  onInsertSheet: () => void
  onAIAssistant: () => void
  onRowSummarizer?: () => void
  onColumnDNA?: () => void
  onInsertChart?: () => void
  onInsertForm?: () => void
  onInsertPivot?: () => void
  onCleanData?: () => void
  onForecast?: () => void
  onGoalSeek?: () => void
  // ── Data ────────────────────────────────────────────
  onMapView: () => void
  onDedupe?: () => void
  /** Group the currently-selected rows (Data > Outline > Group). */
  onGroupRows?: () => void
  /** Ungroup the innermost group at the current row selection. */
  onUngroupRows?: () => void
  // ── Review / Collab / Sharing ───────────────────────
  onComments?: () => void
  onShareLink?: () => void
  onProtectedRanges?: () => void
  onVersionHistory?: () => void
  // ── Review / Help ───────────────────────────────────
  onShortcuts: () => void
  // ── View toggles ────────────────────────────────────
  formulaBarVisible?: boolean
  gridlinesVisible?: boolean
  onToggleFormulaBar?: () => void
  onToggleGridlines?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
}

// ─── Tab bar (with File backstage button) ───────────────────────────────────

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'pageLayout', label: 'Page Layout' },
  { id: 'formulas', label: 'Formulas' },
  { id: 'data', label: 'Data' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
  { id: 'automate', label: 'Automate' },
  { id: 'help', label: 'Help' },
]

function FileBackstageButton({ handlers }: { handlers: RibbonHandlers }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mr-1 flex h-[22px] cursor-default items-center self-center rounded-sm bg-emerald-600 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 select-none"
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
        <DropdownMenuItem onSelect={() => handlers.onPrint?.()}>
          Print
          <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
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
  )
}

function RibbonTabBar({
  activeTab,
  onTabChange,
  handlers,
}: {
  activeTab: RibbonTab
  onTabChange: (tab: RibbonTab) => void
  handlers: RibbonHandlers
}) {
  return (
    <div className="flex h-7 items-stretch border-b border-zinc-200 bg-zinc-50 px-2 dark:border-zinc-800 dark:bg-zinc-900/50">
      {/* File backstage — fixed at left, never scrolls away */}
      <FileBackstageButton handlers={handlers} />

      {/* Ribbon tabs — horizontally scrollable on narrow viewports */}
      <div className="flex flex-1 items-stretch overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative shrink-0 whitespace-nowrap px-3 text-[12px] font-medium transition-colors select-none',
              activeTab === tab.id
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-emerald-600 dark:bg-emerald-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Ribbon({ handlers }: { handlers: RibbonHandlers }) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home')

  return (
    <div className="shrink-0">
      {/* Row 1: Tab selector with File backstage button */}
      <RibbonTabBar activeTab={activeTab} onTabChange={setActiveTab} handlers={handlers} />

      {/* Row 2: Tab content — 96px tall panel (Excel-faithful).
          Previously h-20 (80px), which left only 64px of content area
          after subtracting the group label — too short for the 3
          stacked 26px buttons in the Clipboard group and for the
          68px-tall RibbonLargeButtons used in Styles/Editing. The
          extra 16px brings us inline with Excel 365's ribbon body. */}
      <div className="h-24 shrink-0 overflow-hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {activeTab === 'home' && (
          <HomeTab
            onSortAsc={handlers.onSortAsc}
            onSortDesc={handlers.onSortDesc}
            onCustomSort={handlers.onCustomSort}
            onFilter={handlers.onFilter}
            onFind={handlers.onFind}
            onConditionalFormatting={handlers.onConditionalFormatting}
            onMergeCells={handlers.onMergeCells}
            onUnmergeCells={handlers.onUnmergeCells}
            onClearFormatting={handlers.onClearFormatting}
            onAutoSum={handlers.onAutoSum}
            onInsertRow={handlers.onInsertRow}
            onDeleteRow={handlers.onDeleteRow}
            onInsertSheet={handlers.onInsertSheet}
            onProtectedRanges={handlers.onProtectedRanges}
            onAIAssistant={handlers.onAIAssistant}
          />
        )}
        {activeTab === 'insert' && (
          <InsertTab
            onInsertSheet={handlers.onInsertSheet}
            onInsertRow={handlers.onInsertRow}
            onDeleteRow={handlers.onDeleteRow}
            onInsertChart={handlers.onInsertChart}
            onInsertPivot={handlers.onInsertPivot}
            onInsertForm={handlers.onInsertForm}
            onAIAssistant={handlers.onAIAssistant}
            onRowSummarizer={handlers.onRowSummarizer}
            onColumnDNA={handlers.onColumnDNA}
            onImport={handlers.onImport}
          />
        )}
        {activeTab === 'formulas' && (
          <FormulasTab
            onAIAssistant={handlers.onAIAssistant}
            onAutoSum={handlers.onAutoSum}
            onMapView={handlers.onMapView}
            workbookId={handlers.workbookId ?? ''}
          />
        )}
        {activeTab === 'data' && (
          <DataTab
            onSortAsc={handlers.onSortAsc}
            onSortDesc={handlers.onSortDesc}
            onFilter={handlers.onFilter}
            onValidation={handlers.onValidation}
            onImport={handlers.onImport}
            onDedupe={handlers.onDedupe}
            onCleanData={handlers.onCleanData}
            onForecast={handlers.onForecast}
            onGroupRows={handlers.onGroupRows}
            onUngroupRows={handlers.onUngroupRows}
            onGoalSeek={handlers.onGoalSeek}
          />
        )}
        {activeTab === 'review' && (
          <ReviewTab
            onFind={handlers.onFind}
            onShortcuts={handlers.onShortcuts}
            onRowSummarizer={handlers.onRowSummarizer}
            onComments={handlers.onComments}
            onProtectedRanges={handlers.onProtectedRanges}
            onVersionHistory={handlers.onVersionHistory}
            onShareLink={handlers.onShareLink}
          />
        )}
        {activeTab === 'pageLayout' && (
          <PageLayoutTab
            gridlinesVisible={handlers.gridlinesVisible ?? true}
            onToggleGridlines={handlers.onToggleGridlines ?? (() => {})}
            // Headings visibility isn't yet plumbed through to the
            // sheet page — accept the props but no-op until we wire
            // showHeadings into SheetPage. The checkbox will still
            // toggle locally for the user.
          />
        )}
        {activeTab === 'view' && (
          <ViewTab
            onMapView={handlers.onMapView}
            formulaBarVisible={handlers.formulaBarVisible ?? true}
            gridlinesVisible={handlers.gridlinesVisible ?? true}
            onToggleFormulaBar={handlers.onToggleFormulaBar ?? (() => {})}
            onToggleGridlines={handlers.onToggleGridlines ?? (() => {})}
            onZoomIn={handlers.onZoomIn ?? (() => {})}
            onZoomOut={handlers.onZoomOut ?? (() => {})}
            onZoomReset={handlers.onZoomReset ?? (() => {})}
          />
        )}
        {activeTab === 'automate' && <AutomateTab />}
        {activeTab === 'help' && <HelpTab onShortcuts={handlers.onShortcuts} />}
      </div>
    </div>
  )
}
