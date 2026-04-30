'use client'

import { useState } from 'react'
import { ChevronUp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { HomeTab } from './HomeTab'
import { InsertTab, FormulasTab, DataTab, ReviewTab, ViewTab } from './OtherTabs'

export interface RibbonHandlers {
  // File
  onNewWorkbook?: () => void
  onOpenDashboard?: () => void
  onSaveNow?: () => void
  onImport?: () => void
  onExportCSV?: () => void
  onExportXLSX?: () => void
  onExportPDF?: () => void
  // Home
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onFind: () => void
  onConditionalFormatting: () => void
  onMergeCells: () => void
  onUnmergeCells: () => void
  onClearFormatting: () => void
  onValidation: () => void
  // Insert
  onInsertSheet: () => void
  onInsertChart: () => void
  onInsertForm: () => void
  // Formulas
  onAIAssistant: () => void
  onMapView: () => void
  // Review
  onShortcuts: () => void
}

const TABS = ['Home', 'Insert', 'Formulas', 'Data', 'Review', 'View'] as const
type TabName = (typeof TABS)[number]

export function Ribbon({ handlers }: { handlers: RibbonHandlers }) {
  const [activeTab, setActiveTab] = useState<TabName>('Home')
  const [collapsed, setCollapsed] = useState(false)

  const cs = (label: string) =>
    toast.message('Coming soon', { description: `"${label}" isn't wired yet — tracked in the rebuild plan.` })

  return (
    <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      {/* Tab strip with File backstage and Quick Access */}
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-7 items-center rounded-sm bg-emerald-600 px-3 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              File
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem onSelect={() => handlers.onNewWorkbook?.()}>
              New workbook
              <DropdownMenuShortcut>Ctrl+Alt+N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handlers.onOpenDashboard?.()}>Open recent…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handlers.onSaveNow?.()}>
              Save now
              <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => cs('Make a copy')} className="text-zinc-400">
              Make a copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handlers.onImport?.()}>Import…</DropdownMenuItem>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-400">
              Download
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handlers.onExportCSV?.()}>Comma-separated values (.csv)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handlers.onExportXLSX?.()}>Microsoft Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handlers.onExportPDF?.()}>PDF document (.pdf)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => cs('Print')} className="text-zinc-400">Print</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => cs('Page setup')} className="text-zinc-400">Page setup</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => cs('Move to trash')} className="text-zinc-400">
              Move to trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        <nav role="tablist" aria-label="Ribbon tabs" className="flex">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => {
                if (collapsed && activeTab === t) {
                  // re-clicking active tab while collapsed expands it
                  setCollapsed(false)
                } else {
                  setActiveTab(t)
                  setCollapsed(false)
                }
              }}
              className={cn(
                'relative h-7 px-3 text-[12px] font-medium transition-colors',
                activeTab === t && !collapsed
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800'
              )}
            >
              {t}
              {activeTab === t && !collapsed ? (
                <span className="absolute inset-x-1 -bottom-px h-[2px] bg-emerald-600 dark:bg-emerald-400" />
              ) : null}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand ribbon' : 'Collapse ribbon'}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <ChevronUp
              className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {/* Active tab panel */}
      {!collapsed ? (
        <div className="h-[100px]">
          {activeTab === 'Home' ? (
            <HomeTab
              onSortAsc={handlers.onSortAsc}
              onSortDesc={handlers.onSortDesc}
              onFilter={handlers.onFilter}
              onFind={handlers.onFind}
              onConditionalFormatting={handlers.onConditionalFormatting}
              onMergeCells={handlers.onMergeCells}
              onUnmergeCells={handlers.onUnmergeCells}
              onClearFormatting={handlers.onClearFormatting}
              onValidation={handlers.onValidation}
            />
          ) : null}
          {activeTab === 'Insert' ? (
            <InsertTab
              onInsertSheet={handlers.onInsertSheet}
              onInsertChart={handlers.onInsertChart}
              onInsertForm={handlers.onInsertForm}
              onAIAssistant={handlers.onAIAssistant}
            />
          ) : null}
          {activeTab === 'Formulas' ? (
            <FormulasTab onAIAssistant={handlers.onAIAssistant} onMapView={handlers.onMapView} />
          ) : null}
          {activeTab === 'Data' ? (
            <DataTab
              onSortAsc={handlers.onSortAsc}
              onSortDesc={handlers.onSortDesc}
              onFilter={handlers.onFilter}
              onValidation={handlers.onValidation}
            />
          ) : null}
          {activeTab === 'Review' ? <ReviewTab onShortcuts={handlers.onShortcuts} /> : null}
          {activeTab === 'View' ? <ViewTab onMapView={handlers.onMapView} /> : null}
        </div>
      ) : null}
    </div>
  )
}
