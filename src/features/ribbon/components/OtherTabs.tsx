'use client'

import {
  BarChart3,
  Database,
  Dna,
  FileSpreadsheet,
  Filter,
  Network,
  RefreshCcw,
  Search,
  Sigma,
  SortAsc,
  Sparkles,
  ShieldCheck,
  Zap,
  ZoomIn,
  ZoomOut,
  LayoutList,
  CircleHelp,
  Rows3,
} from 'lucide-react'
import { RibbonGroup, RibbonLargeButton, RibbonButton } from './RibbonPrimitives'

// ─── Insert ──────────────────────────────────────────────────────────────────

interface InsertTabProps {
  onInsertSheet: () => void
  onAIAssistant: () => void
  onRowSummarizer: () => void
  onColumnDNA: () => void
  onValidation: () => void
  onImport: () => void
}

export function InsertTab({
  onInsertSheet,
  onAIAssistant,
  onRowSummarizer,
  onColumnDNA,
  onValidation,
  onImport,
}: InsertTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Sheets">
        <RibbonLargeButton
          label="New Sheet"
          icon={<FileSpreadsheet className="text-emerald-500" />}
          onClick={onInsertSheet}
        />
      </RibbonGroup>

      <RibbonGroup label="AI Features">
        <RibbonLargeButton
          label="AI Formula"
          icon={<Sparkles className="text-amber-500" />}
          onClick={onAIAssistant}
        />
        <RibbonLargeButton
          label="AI Summarise"
          icon={<LayoutList className="text-violet-500" />}
          onClick={onRowSummarizer}
        />
        <RibbonLargeButton
          label="Column DNA"
          icon={<Dna className="text-cyan-500" />}
          onClick={onColumnDNA}
        />
      </RibbonGroup>

      <RibbonGroup label="Data">
        <RibbonLargeButton
          label="Import"
          icon={<Database className="text-blue-500" />}
          onClick={onImport}
        />
        <RibbonLargeButton
          label="Validation"
          icon={<ShieldCheck className="text-amber-500" />}
          onClick={onValidation}
        />
      </RibbonGroup>

      <RibbonGroup label="Charts" className="border-r-0">
        <div className="flex flex-col items-start justify-center gap-1 px-1">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-5 w-5 text-blue-300" />
            <span className="text-[10px] text-zinc-400">Charts builder</span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">coming next release</span>
        </div>
      </RibbonGroup>
    </div>
  )
}

// ─── Formulas ────────────────────────────────────────────────────────────────

interface FormulasTabProps {
  onAIAssistant: () => void
  onAutoSum: () => void
  onMapView: () => void
}

export function FormulasTab({ onAIAssistant, onAutoSum, onMapView }: FormulasTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Quick Insert">
        <RibbonLargeButton
          label="AutoSum"
          icon={<Sigma className="text-orange-500" />}
          onClick={onAutoSum}
          showCaret
        />
      </RibbonGroup>

      <RibbonGroup label="Quiksheets AI">
        <RibbonLargeButton
          label="AI Formula"
          icon={<Sparkles className="text-amber-500" />}
          onClick={onAIAssistant}
        />
        <div className="flex flex-col justify-center gap-0.5 px-1">
          <span className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            Hover any formula
          </span>
          <span className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            cell for AI explain
          </span>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Auditing" className="border-r-0">
        <RibbonLargeButton
          label="Map View"
          icon={<Network className="text-emerald-500" />}
          onClick={onMapView}
        />
      </RibbonGroup>
    </div>
  )
}

// ─── Data ────────────────────────────────────────────────────────────────────

interface DataTabProps {
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onValidation: () => void
  onImport: () => void
  onDedupe: () => void
}

export function DataTab({
  onSortAsc,
  onSortDesc,
  onFilter,
  onValidation,
  onImport,
  onDedupe,
}: DataTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Get Data">
        <RibbonLargeButton
          label="From CSV"
          icon={<Database className="text-emerald-500" />}
          onClick={onImport}
        />
      </RibbonGroup>

      <RibbonGroup label="Sort & Filter">
        <RibbonLargeButton
          label="Sort A→Z"
          icon={<SortAsc className="text-blue-500" />}
          onClick={onSortAsc}
        />
        <RibbonLargeButton
          label="Sort Z→A"
          icon={<SortAsc className="text-blue-500 rotate-180" />}
          onClick={onSortDesc}
        />
        <RibbonLargeButton
          label="Filter"
          icon={<Filter className="text-blue-500" />}
          onClick={onFilter}
        />
      </RibbonGroup>

      <RibbonGroup label="Data Tools" className="border-r-0">
        <RibbonLargeButton
          label="Validation"
          icon={<ShieldCheck className="text-amber-500" />}
          onClick={onValidation}
        />
        <RibbonLargeButton
          label="Remove Dupes"
          icon={<Zap className="text-rose-500" />}
          onClick={onDedupe}
        />
        <RibbonLargeButton
          label="Refresh"
          icon={<RefreshCcw className="text-zinc-500" />}
          onClick={() => window.location.reload()}
        />
      </RibbonGroup>
    </div>
  )
}

// ─── Review ──────────────────────────────────────────────────────────────────

interface ReviewTabProps {
  onFind: () => void
  onShortcuts: () => void
  onRowSummarizer: () => void
}

export function ReviewTab({ onFind, onShortcuts, onRowSummarizer }: ReviewTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Search">
        <RibbonLargeButton
          label="Find & Replace"
          icon={<Search className="text-blue-500" />}
          onClick={onFind}
        />
      </RibbonGroup>

      <RibbonGroup label="AI Insights">
        <RibbonLargeButton
          label="AI Summarise"
          icon={<Rows3 className="text-violet-500" />}
          onClick={onRowSummarizer}
        />
      </RibbonGroup>

      <RibbonGroup label="Help" className="border-r-0">
        <RibbonLargeButton
          label="Shortcuts"
          icon={<CircleHelp className="text-zinc-500" />}
          onClick={onShortcuts}
        />
      </RibbonGroup>
    </div>
  )
}

// ─── View ────────────────────────────────────────────────────────────────────

interface ViewTabProps {
  onMapView: () => void
  formulaBarVisible: boolean
  gridlinesVisible: boolean
  onToggleFormulaBar: () => void
  onToggleGridlines: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function ViewTab({
  onMapView,
  formulaBarVisible,
  gridlinesVisible,
  onToggleFormulaBar,
  onToggleGridlines,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ViewTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Show">
        <div className="flex flex-col gap-1.5 px-1 py-1">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={formulaBarVisible}
              onChange={onToggleFormulaBar}
              className="h-3 w-3 rounded accent-emerald-600"
            />
            Formula Bar
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={gridlinesVisible}
              onChange={onToggleGridlines}
              className="h-3 w-3 rounded accent-emerald-600"
            />
            Gridlines
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            <input
              type="checkbox"
              defaultChecked
              disabled
              className="h-3 w-3 rounded opacity-50"
            />
            Headings
          </label>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <div className="flex flex-col gap-0.5">
          <RibbonButton
            label="Zoom in"
            icon={<ZoomIn className="h-3.5 w-3.5" />}
            onClick={onZoomIn}
          />
          <RibbonButton
            label="Zoom out"
            icon={<ZoomOut className="h-3.5 w-3.5" />}
            onClick={onZoomOut}
          />
          <RibbonButton
            label="Reset to 100%"
            icon={<span className="text-[10px] font-bold leading-none">100%</span>}
            onClick={onZoomReset}
          />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Dependency" className="border-r-0">
        <RibbonLargeButton
          label="Map View"
          icon={<Network className="text-emerald-500" />}
          onClick={onMapView}
        />
        <div className="flex flex-col justify-center gap-0.5 px-1">
          <span className="text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
            Ctrl+M to toggle
          </span>
        </div>
      </RibbonGroup>
    </div>
  )
}
