'use client'

import {
  BarChart3,
  Calculator,
  Calendar,
  Camera,
  CircleHelp,
  Clock,
  Code,
  Database,
  FileSpreadsheet,
  Filter,
  Hash,
  ImageIcon,
  LineChart,
  Link as LinkIcon,
  MessageSquare,
  Network,
  PieChart,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  ShieldCheck,
  Sigma,
  SortAsc,
  SquareMousePointer,
  Sparkles,
  Star,
  Table,
  Type,
  Users,
  Wand2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { RibbonGroup, RibbonLargeButton } from './RibbonPrimitives'

const cs = (label: string) =>
  toast.message('Coming soon', { description: `"${label}" isn't wired yet — tracked in the rebuild plan.` })

interface InsertTabProps {
  onInsertSheet: () => void
  onInsertChart: () => void
  onInsertForm: () => void
  onAIAssistant: () => void
}

export function InsertTab({ onInsertSheet, onInsertChart, onInsertForm, onAIAssistant }: InsertTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Tables">
        <RibbonLargeButton label="PivotTable" icon={<Table className="text-blue-500" />} onClick={() => cs('Pivot table')} showCaret />
        <RibbonLargeButton label="Table" icon={<Table className="text-emerald-500" />} onClick={() => cs('Format as table')} />
        <RibbonLargeButton label="Sheet" icon={<FileSpreadsheet className="text-purple-500" />} onClick={onInsertSheet} />
      </RibbonGroup>

      <RibbonGroup label="Illustrations">
        <RibbonLargeButton label="Picture" icon={<ImageIcon className="text-cyan-500" />} onClick={() => cs('Picture')} showCaret />
        <RibbonLargeButton label="Camera" icon={<Camera className="text-cyan-500" />} onClick={() => cs('Screen capture')} />
      </RibbonGroup>

      <RibbonGroup label="Charts">
        <RibbonLargeButton label="Bar" icon={<BarChart3 className="text-blue-500" />} onClick={onInsertChart} showCaret />
        <RibbonLargeButton label="Line" icon={<LineChart className="text-emerald-500" />} onClick={onInsertChart} showCaret />
        <RibbonLargeButton label="Pie" icon={<PieChart className="text-pink-500" />} onClick={onInsertChart} showCaret />
      </RibbonGroup>

      <RibbonGroup label="AI">
        <RibbonLargeButton label="AI Formula" icon={<Sparkles className="text-amber-500" />} onClick={onAIAssistant} showCaret />
        <RibbonLargeButton label="Form" icon={<SquareMousePointer className="text-fuchsia-500" />} onClick={onInsertForm} />
      </RibbonGroup>

      <RibbonGroup label="Links" className="border-r-0">
        <RibbonLargeButton label="Link" icon={<LinkIcon className="text-blue-500" />} onClick={() => cs('Insert link')} />
        <RibbonLargeButton label="Comment" icon={<MessageSquare className="text-blue-500" />} onClick={() => cs('Cell comment')} />
        <RibbonLargeButton label="Symbol" icon={<Hash className="text-zinc-500" />} onClick={() => cs('Insert symbol')} />
      </RibbonGroup>
    </div>
  )
}

interface FormulasTabProps {
  onAIAssistant: () => void
  onMapView: () => void
}

export function FormulasTab({ onAIAssistant, onMapView }: FormulasTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Function Library" className="min-w-[400px]">
        <RibbonLargeButton label="AutoSum" icon={<Sigma className="text-orange-500" />} onClick={() => cs('AutoSum')} showCaret />
        <RibbonLargeButton label="Recently" icon={<Clock className="text-blue-500" />} onClick={() => cs('Recently used')} showCaret />
        <RibbonLargeButton label="Financial" icon={<Calculator className="text-emerald-500" />} onClick={() => cs('Financial functions')} showCaret />
        <RibbonLargeButton label="Logical" icon={<Code className="text-violet-500" />} onClick={() => cs('Logical functions')} showCaret />
        <RibbonLargeButton label="Text" icon={<Type className="text-rose-500" />} onClick={() => cs('Text functions')} showCaret />
        <RibbonLargeButton label="Date" icon={<Calendar className="text-cyan-500" />} onClick={() => cs('Date & time functions')} showCaret />
        <RibbonLargeButton label="Lookup" icon={<Search className="text-sky-500" />} onClick={() => cs('Lookup functions')} showCaret />
      </RibbonGroup>

      <RibbonGroup label="Quiksheets AI">
        <RibbonLargeButton label="AI Formula" icon={<Sparkles className="text-amber-500" />} onClick={onAIAssistant} />
        <RibbonLargeButton label="Explain" icon={<Wand2 className="text-amber-500" />} onClick={() => cs('Hover any formula cell to see the explainer')} />
      </RibbonGroup>

      <RibbonGroup label="Auditing" className="border-r-0">
        <RibbonLargeButton label="Map View" icon={<Network className="text-emerald-500" />} onClick={onMapView} />
        <RibbonLargeButton label="Trace" icon={<Network className="text-emerald-500" />} onClick={() => cs('Trace precedents')} />
        <RibbonLargeButton label="Calculate" icon={<RefreshCcw className="text-emerald-500" />} onClick={() => cs('Calculate now')} />
      </RibbonGroup>
    </div>
  )
}

interface DataTabProps {
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onValidation: () => void
}

export function DataTab({ onSortAsc, onSortDesc, onFilter, onValidation }: DataTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Get Data">
        <RibbonLargeButton label="From CSV" icon={<Database className="text-emerald-500" />} onClick={() => cs('From CSV — use the Import button in the header')} />
        <RibbonLargeButton label="From URL" icon={<LinkIcon className="text-emerald-500" />} onClick={() => cs('Import from URL')} />
        <RibbonLargeButton label="Refresh" icon={<RefreshCcw className="text-emerald-500" />} onClick={() => cs('Refresh connections')} />
      </RibbonGroup>

      <RibbonGroup label="Sort & Filter">
        <RibbonLargeButton label="Sort A→Z" icon={<SortAsc className="text-blue-500" />} onClick={onSortAsc} />
        <RibbonLargeButton label="Sort Z→A" icon={<SortAsc className="text-blue-500 rotate-180" />} onClick={onSortDesc} />
        <RibbonLargeButton label="Filter" icon={<Filter className="text-blue-500" />} onClick={onFilter} />
      </RibbonGroup>

      <RibbonGroup label="Data Tools">
        <RibbonLargeButton label="Validation" icon={<ShieldCheck className="text-amber-500" />} onClick={onValidation} />
        <RibbonLargeButton label="Dedupe" icon={<Zap className="text-amber-500" />} onClick={() => cs('Remove duplicates')} />
        <RibbonLargeButton label="Text→Cols" icon={<Type className="text-amber-500" />} onClick={() => cs('Text to columns')} />
      </RibbonGroup>

      <RibbonGroup label="Forecast" className="border-r-0">
        <RibbonLargeButton label="Forecast" icon={<LineChart className="text-violet-500" />} onClick={() => cs('Forecasting (P2 feature, behind flag)')} />
        <RibbonLargeButton label="What-If" icon={<CircleHelp className="text-violet-500" />} onClick={() => cs('What-if analysis')} />
      </RibbonGroup>
    </div>
  )
}

interface ReviewTabProps {
  onShortcuts: () => void
}

export function ReviewTab({ onShortcuts }: ReviewTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Proofing">
        <RibbonLargeButton label="Spelling" icon={<CircleHelp className="text-blue-500" />} onClick={() => cs('Spell check')} />
        <RibbonLargeButton label="Thesaurus" icon={<Type className="text-blue-500" />} onClick={() => cs('Thesaurus')} />
      </RibbonGroup>

      <RibbonGroup label="Insights">
        <RibbonLargeButton label="Smart" icon={<Sparkles className="text-amber-500" />} onClick={() => cs('Smart insights')} />
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <RibbonLargeButton label="New" icon={<Plus className="text-emerald-500" />} onClick={() => cs('Add comment')} />
        <RibbonLargeButton label="Show" icon={<MessageSquare className="text-emerald-500" />} onClick={() => cs('Show all comments')} />
      </RibbonGroup>

      <RibbonGroup label="Protect" className="border-r-0">
        <RibbonLargeButton label="Sheet" icon={<Shield className="text-rose-500" />} onClick={() => cs('Protect sheet')} />
        <RibbonLargeButton label="Workbook" icon={<Shield className="text-rose-500" />} onClick={() => cs('Protect workbook')} />
        <RibbonLargeButton label="Share" icon={<Users className="text-rose-500" />} onClick={() => cs('Share workbook')} />
        <RibbonLargeButton label="Help" icon={<CircleHelp className="text-rose-500" />} onClick={onShortcuts} />
      </RibbonGroup>
    </div>
  )
}

interface ViewTabProps {
  onMapView: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
}

export function ViewTab({ onMapView }: ViewTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      <RibbonGroup label="Workbook Views">
        <RibbonLargeButton label="Normal" icon={<FileSpreadsheet className="text-blue-500" />} onClick={() => cs('Normal view')} />
        <RibbonLargeButton label="Page Layout" icon={<FileSpreadsheet className="text-blue-500" />} onClick={() => cs('Page layout view')} />
        <RibbonLargeButton label="Custom" icon={<Star className="text-blue-500" />} onClick={() => cs('Custom views')} />
      </RibbonGroup>

      <RibbonGroup label="Show">
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" defaultChecked className="h-3 w-3 rounded" /> Formula Bar
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" defaultChecked className="h-3 w-3 rounded" /> Gridlines
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" defaultChecked className="h-3 w-3 rounded" /> Headings
          </label>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <RibbonLargeButton label="Zoom" icon={<ZoomIn className="text-zinc-600" />} onClick={() => cs('Zoom dialog')} />
        <RibbonLargeButton label="100%" icon={<span className="text-xs font-bold">100%</span>} onClick={() => cs('Zoom to 100%')} />
        <RibbonLargeButton label="Selection" icon={<ZoomOut className="text-zinc-600" />} onClick={() => cs('Zoom to selection')} />
      </RibbonGroup>

      <RibbonGroup label="Window">
        <RibbonLargeButton label="Freeze" icon={<Hash className="text-zinc-600" />} onClick={() => cs('Freeze rows / columns')} showCaret />
        <RibbonLargeButton label="Split" icon={<Hash className="text-zinc-600" />} onClick={() => cs('Split window')} />
      </RibbonGroup>

      <RibbonGroup label="Insights" className="border-r-0">
        <RibbonLargeButton label="Map View" icon={<Network className="text-emerald-500" />} onClick={onMapView} />
      </RibbonGroup>
    </div>
  )
}
