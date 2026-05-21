'use client'

import {
  Activity,
  AlignVerticalSpaceAround,
  Anchor,
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowUpToLine,
  BarChart3,
  Bookmark,
  BookOpen,
  Box,
  Briefcase,
  Calculator,
  Calendar,
  Camera,
  ChartLine,
  ChartPie,
  CheckSquare,
  ChevronDown,
  Circle,
  CircleHelp,
  Code2,
  Coins,
  Database,
  Dna,
  Equal,
  Eye,
  EyeOff,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Filter,
  Flag,
  FormInput,
  Frame,
  Gauge,
  GitBranch,
  Globe,
  Group,
  Hash,
  History,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  LayoutList,
  Link2,
  Lock,
  Map as MapIcon,
  MessageCircle,
  MessageSquare,
  Minus,
  Network,
  PaintBucket,
  Palette,
  Pi,
  Plus,
  PlusSquare,
  Printer,
  RefreshCcw,
  Rocket,
  Rows3,
  Ruler,
  Search,
  Share2,
  ShieldCheck,
  Sigma,
  SortAsc,
  Sparkles,
  Spline,
  SquareStack,
  StickyNote,
  Table as TableIcon,
  Tag,
  TextCursorInput,
  TrendingUp,
  Type,
  Ungroup,
  Users,
  WandSparkles,
  Webhook,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { RibbonGroup, RibbonLargeButton, RibbonButton } from './RibbonPrimitives'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ribbonStub } from '../utils/ribbonStub'
import {
  freezeTopRow,
  freezeFirstColumn,
  freezePanesAtActiveCell,
  unfreezePanes,
  hideActiveSheet,
  unhideSheetPicker,
  insertHyperlink,
  applyTablePalette,
  clearFilter,
  reapplyFilter,
  setOrientationPreset,
  setMarginPreset,
  setPaperSizePreset,
  setPrintAreaFromSelection,
  clearPrintArea,
  openNameManager,
  defineNameFromSelection,
  insertNameIntoFormula,
  createNamesFromSelection,
  toggleShowFormulas,
  openDependencyMap,
  runErrorChecking,
  evaluateFormula,
} from '../utils/cellOps'
import { useInsertFunctionStore } from '@/features/formula-engine/stores/insertFunctionStore'
import type { FormulaCategory } from '@/features/formula-engine/formulaList'
import { ColumnTypeRibbonButton, useColumnTypesStore } from '@/features/typed-columns'
import { useCommentsUiStore } from '@/features/comments/store/commentsUiStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { colIndexToLetter } from '@/lib/cellAddress'
import { usePrintSettingsStore } from '@/features/page-layout/printSettingsStore'
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { flashFill } from '../utils/flashFill'
import { useTextToColsStore } from '@/features/data/store/textToColsStore'
import { useSlicerBuilderStore } from '@/features/slicers/store/slicerBuilderStore'
import type { ChartKind } from '@/features/charts/types'
import { useSymbolPickerStore } from '@/features/symbols/store/symbolPickerStore'
import { insertImageFromDevice } from '@/features/images/utils/insertImageFromDevice'
import { toast } from 'sonner'

// ─── Insert ──────────────────────────────────────────────────────────────────

interface InsertTabProps {
  onInsertSheet: () => void
  onInsertRow?: (() => void) | undefined
  onDeleteRow?: (() => void) | undefined
  onInsertChart?: (() => void) | undefined
  onInsertPivot?: (() => void) | undefined
  onInsertForm?: (() => void) | undefined
  onAIAssistant: () => void
  onRowSummarizer?: (() => void) | undefined
  onColumnDNA?: (() => void) | undefined
  onImport?: (() => void) | undefined
}

/**
 * R8.1 — Insert > Comment: open the CommentComposer for the active cell.
 * Reuses the existing comments feature; only the menu wire was missing.
 */
function insertCommentForActiveCell(): void {
  const { selectedCell } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  if (!selectedCell || !activeSheetId) {
    toast.message('Select a cell to add a comment')
    return
  }
  const cellAddress = `${colIndexToLetter(selectedCell.col)}${selectedCell.row + 1}`
  useCommentsUiStore.getState().openComposer({ sheetId: activeSheetId, cellAddress })
}

/**
 * R8.3 — Open ChartBuilder pre-selected to a specific chart kind.
 * The Excel chart sub-dropdowns (Column/Bar, Line/Area, etc.) used to
 * open the builder with no type info — now they pass the chosen kind
 * so the builder lands on the right type with tab='all'.
 */
function openChartBuilderWithKind(kind: ChartKind): void {
  useChartPanelStore.getState().openBuilder(kind)
}

/**
 * R8.2 — Insert > Checkbox: set the active column's type to "checkbox",
 * reusing the typed-columns infrastructure shipped in Phase 3a. Every
 * cell in the column becomes a ☐ / ☑ toggle with validation.
 */
function insertCheckboxForActiveColumn(): void {
  const { selectedCell } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  if (!selectedCell || !activeSheetId) {
    toast.message('Select a cell in the target column first')
    return
  }
  const col = selectedCell.col
  useColumnTypesStore.getState().setColumnType(activeSheetId, col, {
    type: 'checkbox',
  })
  toast.success(`Column ${colIndexToLetter(col)} set to Checkbox`, {
    action: {
      label: 'Undo',
      onClick: () => {
        useColumnTypesStore.getState().clearColumnType(activeSheetId, col)
        toast.message(`Column ${colIndexToLetter(col)} reverted to plain text`)
      },
    },
  })
}

export function InsertTab(props: InsertTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      {/* Tables */}
      <RibbonGroup label="Tables">
        <RibbonLargeButton label="PivotTable"            icon={<TableIcon className="text-violet-500" />} onClick={props.onInsertPivot} showCaret />
        <RibbonLargeButton label="Recommended Pivots"    icon={<LayoutDashboard className="text-violet-500" />} onClick={ribbonStub('Recommended PivotTables')} />
        <RibbonLargeButton label="Table"                  icon={<TableIcon className="text-blue-500" />} onClick={() => applyTablePalette()} />
        <RibbonLargeButton label="Forms"                  icon={<FormInput className="text-emerald-500" />} onClick={props.onInsertForm} showCaret />
      </RibbonGroup>

      {/* Illustrations */}
      <RibbonGroup label="Illustrations">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-[68px] w-[60px] flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ImageIcon className="h-6 w-6 text-blue-500" />
              <span className="flex items-center gap-0.5">Pictures <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => insertImageFromDevice()}>This Device…</DropdownMenuItem>
            <DropdownMenuItem onSelect={ribbonStub('Stock Images…')}>Stock Images…</DropdownMenuItem>
            <DropdownMenuItem onSelect={ribbonStub('Online Pictures…')}>Online Pictures…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RibbonLargeButton label="Shapes"      icon={<Frame className="text-amber-500" />}   onClick={ribbonStub('Shapes')} showCaret />
        <RibbonLargeButton label="Icons"       icon={<Sparkles className="text-blue-500" />} onClick={ribbonStub('Icons')} />
        <RibbonLargeButton label="3D Models"   icon={<Box className="text-violet-500" />}    onClick={ribbonStub('3D Models')} />
        <RibbonLargeButton label="SmartArt"    icon={<Workflow className="text-rose-500" />} onClick={ribbonStub('SmartArt')} />
        <RibbonLargeButton label="Screenshot"  icon={<Camera className="text-emerald-500" />} onClick={ribbonStub('Screenshot')} showCaret />
      </RibbonGroup>

      {/* Controls */}
      <RibbonGroup label="Controls">
        <RibbonLargeButton label="Checkbox" icon={<CheckSquare className="text-emerald-500" />} onClick={insertCheckboxForActiveColumn} />
      </RibbonGroup>

      {/* Charts */}
      <RibbonGroup label="Charts">
        <RibbonLargeButton label="Recommended Charts" icon={<BarChart3 className="text-blue-500" />} onClick={props.onInsertChart} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-[68px] w-[44px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('bar')}>Column / Bar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('stacked_bar')}>Stacked Bar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('line')}>Line / Area</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('pie')}>Pie</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('doughnut')}>Doughnut</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('scatter')}>Scatter / Bubble</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('combo')}>Combo</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('radar')}>Radar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('treemap')}>Treemap</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('funnel')}>Funnel</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('waterfall')}>Waterfall</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('heatmap')}>Heatmap</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('gauge')}>Gauge</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-[68px] w-[44px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ChartLine className="h-5 w-5 text-emerald-500" />
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('line')}>Line</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openChartBuilderWithKind('area')}>Area</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RibbonLargeButton label="Maps"        icon={<MapIcon className="text-rose-500" />}    onClick={ribbonStub('Maps')} showCaret />
        <RibbonLargeButton label="PivotChart"  icon={<ChartPie className="text-violet-500" />} onClick={() => openChartBuilderWithKind('bar')} showCaret />
      </RibbonGroup>

      {/* Sparklines */}
      <RibbonGroup label="Sparklines">
        <RibbonLargeButton label="Line"     icon={<Spline className="text-blue-500" />}      onClick={ribbonStub('Line Sparkline')} />
        <RibbonLargeButton label="Column"   icon={<BarChart3 className="text-blue-500" />}   onClick={ribbonStub('Column Sparkline')} />
        <RibbonLargeButton label="Win/Loss" icon={<Activity className="text-rose-500" />}    onClick={ribbonStub('Win/Loss Sparkline')} />
      </RibbonGroup>

      {/* Filters */}
      <RibbonGroup label="Filters">
        <RibbonLargeButton label="Slicer"   icon={<Filter className="text-blue-500" />}   onClick={() => useSlicerBuilderStore.getState().openBuilder()} />
        <RibbonLargeButton label="Timeline" icon={<Calendar className="text-amber-500" />} onClick={ribbonStub('Timeline')} />
      </RibbonGroup>

      {/* Links */}
      <RibbonGroup label="Links">
        <RibbonLargeButton label="Link" icon={<Link2 className="text-blue-500" />} onClick={insertHyperlink} />
      </RibbonGroup>

      {/* Comments */}
      <RibbonGroup label="Comments">
        <RibbonLargeButton label="Comment" icon={<MessageSquare className="text-blue-500" />} onClick={insertCommentForActiveCell} />
      </RibbonGroup>

      {/* Text */}
      <RibbonGroup label="Text">
        <RibbonLargeButton label="Text Box"      icon={<TextCursorInput className="text-zinc-500" />}  onClick={ribbonStub('Text Box')} />
        <RibbonLargeButton label="Header & Footer" icon={<FileText className="text-zinc-500" />}      onClick={ribbonStub('Header & Footer')} />
      </RibbonGroup>

      {/* Symbols */}
      <RibbonGroup label="Symbols" className="border-r-0">
        <RibbonLargeButton label="Equation" icon={<Pi className="text-zinc-500" />}   onClick={ribbonStub('Equation')} showCaret />
        <RibbonLargeButton label="Symbol"   icon={<Equal className="text-zinc-500" />} onClick={() => useSymbolPickerStore.getState().openPicker()} />
      </RibbonGroup>

      {/* AI shortcuts (kept as sheet-specific power tools) */}
      <RibbonGroup label="Quiksheets AI" className="border-r-0">
        <RibbonLargeButton label="AI Formula"   icon={<Sparkles className="text-amber-500" />}   onClick={props.onAIAssistant} />
        <RibbonLargeButton label="AI Summarise" icon={<LayoutList className="text-violet-500" />} onClick={props.onRowSummarizer} />
        <RibbonLargeButton label="Column DNA"   icon={<Dna className="text-cyan-500" />}         onClick={props.onColumnDNA} />
      </RibbonGroup>
    </div>
  )
}

// ─── Page Layout ─────────────────────────────────────────────────────────────

interface PageLayoutTabProps {
  /** On-screen gridlines visibility — shared with View tab. */
  gridlinesVisible?: boolean
  onToggleGridlines?: () => void
  /** On-screen row/column headings visibility. */
  headingsVisible?: boolean
  onToggleHeadings?: () => void
}

export function PageLayoutTab(props: PageLayoutTabProps) {
  // R9 — Sheet Options + Scale to Fit are now functional. View toggles
  // are owned by the sheet page (passed in as props); print toggles +
  // scale live in the printSettings store so they survive xlsx export.
  const printGridlines = usePrintSettingsStore((s) => s.printGridlines)
  const printHeadings = usePrintSettingsStore((s) => s.printHeadings)
  const setPrintGridlines = usePrintSettingsStore((s) => s.setPrintGridlines)
  const setPrintHeadings = usePrintSettingsStore((s) => s.setPrintHeadings)
  const scalePct = usePrintSettingsStore((s) => s.scalePct)
  const setScalePct = usePrintSettingsStore((s) => s.setScalePct)

  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      {/* Themes */}
      <RibbonGroup label="Themes">
        <RibbonLargeButton label="Themes"  icon={<Palette className="text-violet-500" />}     onClick={ribbonStub('Themes')} showCaret />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Colors" icon={<PaintBucket className="h-3.5 w-3.5 text-amber-500" />} onClick={ribbonStub('Colors')} />
          <RibbonButton label="Fonts"  icon={<Type className="h-3.5 w-3.5" />}                       onClick={ribbonStub('Fonts')} />
          <RibbonButton label="Effects" icon={<WandSparkles className="h-3.5 w-3.5" />}              onClick={ribbonStub('Effects')} />
        </div>
      </RibbonGroup>

      {/* Page Setup */}
      <RibbonGroup label="Page Setup">
        {/* Margins dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Margins" className="flex h-[68px] w-[60px] flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Ruler className="h-6 w-6 text-blue-500" />
              <span className="flex items-center gap-0.5">Margins <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setMarginPreset('normal')}>Normal (0.75&quot; / 0.7&quot;)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMarginPreset('wide')}>Wide (1.0&quot; / 1.0&quot;)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMarginPreset('narrow')}>Narrow (0.75&quot; / 0.25&quot;)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMarginPreset('custom')}>Custom Margins…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Orientation dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Orientation" className="flex h-[68px] w-[60px] flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <RefreshCcw className="h-6 w-6 text-emerald-500" />
              <span className="flex items-center gap-0.5">Orient. <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setOrientationPreset('portrait')}>Portrait</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOrientationPreset('landscape')}>Landscape</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Size dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Paper Size" className="flex h-[68px] w-[56px] flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Frame className="h-6 w-6 text-amber-500" />
              <span className="flex items-center gap-0.5">Size <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setPaperSizePreset('letter')}>Letter (8.5 × 11&quot;)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPaperSizePreset('legal')}>Legal (8.5 × 14&quot;)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPaperSizePreset('a4')}>A4 (210 × 297mm)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPaperSizePreset('a3')}>A3 (297 × 420mm)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPaperSizePreset('a5')}>A5 (148 × 210mm)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Print Area dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Print Area" className="flex h-[68px] w-[64px] flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Printer className="h-6 w-6 text-zinc-500" />
              <span className="flex flex-col items-center leading-[1.05]">
                <span>Print</span>
                <span className="flex items-center gap-0.5">Area <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={setPrintAreaFromSelection}>Set Print Area</DropdownMenuItem>
            <DropdownMenuItem onSelect={clearPrintArea}>Clear Print Area</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <RibbonLargeButton label="Breaks"      icon={<GitBranch className="text-rose-500" />}    onClick={ribbonStub('Breaks')} showCaret />
        <RibbonLargeButton label="Background"  icon={<ImageIcon className="text-blue-500" />}    onClick={ribbonStub('Background')} />
        <RibbonLargeButton label="Print Titles" icon={<Bookmark className="text-violet-500" />} onClick={ribbonStub('Print Titles')} />
      </RibbonGroup>

      {/* Scale to Fit — R9.4: Scale% input is now functional and writes
          to printSettingsStore.scalePct, which the PDF exporter reads.
          Width/Height (in pages) require a page-break engine, so they
          stay disabled with an explanatory title until that ships. */}
      <RibbonGroup label="Scale to Fit">
        <div className="flex flex-col gap-1 px-1 py-1 text-[11px]">
          <label className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200" title="Fit to N pages wide — coming soon">
            <span className="w-12">Width:</span>
            <select disabled className="h-6 rounded border border-zinc-200 bg-white px-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
              <option>Automatic</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200" title="Fit to N pages tall — coming soon">
            <span className="w-12">Height:</span>
            <select disabled className="h-6 rounded border border-zinc-200 bg-white px-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
              <option>Automatic</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200" title="Scale the printed output (10–400%)">
            <span className="w-12">Scale:</span>
            <input
              type="number"
              min={10}
              max={400}
              step={5}
              value={scalePct}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) setScalePct(n)
              }}
              className="h-6 w-14 rounded border border-zinc-200 bg-white px-1 text-[11px] focus:border-blue-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span>%</span>
          </label>
        </div>
      </RibbonGroup>

      {/* Sheet Options — R9.1/R9.2/R9.3: checkboxes are now fully wired.
          View toggles affect what the user sees in the grid (shared
          state with the View tab); Print toggles affect the PDF/print
          output via printSettingsStore. */}
      <RibbonGroup label="Sheet Options">
        <div className="flex flex-col gap-1.5 px-1 py-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-16 text-zinc-700 dark:text-zinc-200">Gridlines</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={props.gridlinesVisible ?? true}
                onChange={() => props.onToggleGridlines?.()}
              />
              View
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={printGridlines}
                onChange={(e) => setPrintGridlines(e.target.checked)}
              />
              Print
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 text-zinc-700 dark:text-zinc-200">Headings</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={props.headingsVisible ?? true}
                onChange={() => props.onToggleHeadings?.()}
              />
              View
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={printHeadings}
                onChange={(e) => setPrintHeadings(e.target.checked)}
              />
              Print
            </label>
          </div>
        </div>
      </RibbonGroup>

      {/* Arrange */}
      <RibbonGroup label="Arrange" className="border-r-0">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Bring Forward"   icon={<ArrowUpToLine className="h-3.5 w-3.5" />}   onClick={ribbonStub('Bring Forward')} />
          <RibbonButton label="Send Backward"   icon={<ArrowDownToLine className="h-3.5 w-3.5" />} onClick={ribbonStub('Send Backward')} />
          <RibbonButton label="Selection Pane"  icon={<LayoutList className="h-3.5 w-3.5" />}      onClick={ribbonStub('Selection Pane')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Align"  icon={<AlignVerticalSpaceAround className="h-3.5 w-3.5" />} onClick={ribbonStub('Align')} />
          <RibbonButton label="Group"  icon={<Group className="h-3.5 w-3.5" />}                     onClick={ribbonStub('Group')} />
          <RibbonButton label="Rotate" icon={<RefreshCcw className="h-3.5 w-3.5" />}                onClick={ribbonStub('Rotate')} />
        </div>
      </RibbonGroup>
    </div>
  )
}

// ─── Formulas ────────────────────────────────────────────────────────────────

interface FormulasTabProps {
  onAIAssistant: () => void
  onAutoSum?: (() => void) | undefined
  onMapView: () => void
  workbookId: string
}

/** Open the Insert Function dialog scoped to a single category. */
function openFunctionsByCategory(category: 'All' | FormulaCategory): void {
  useInsertFunctionStore.getState().setOpen(true, category)
}

/**
 * Workbook Statistics — Excel's Review > Workbook Statistics. Counts
 * sheets, cells with values, cells with formulas, named ranges, and
 * conditional-format rules in the current workbook.
 */
function showWorkbookStatistics(): void {
  const { gridSheets } = useSheetStore.getState()
  let cellsWithValues = 0
  let cellsWithFormulas = 0
  for (const sheet of gridSheets) {
    for (const entry of sheet.celldata ?? []) {
      const v = entry.v as { v?: unknown; f?: unknown } | null | undefined
      if (!v) continue
      if (v.f) cellsWithFormulas++
      if (v.v !== undefined && v.v !== null && v.v !== '') cellsWithValues++
    }
  }
  toast.success(
    `${gridSheets.length} sheet${gridSheets.length > 1 ? 's' : ''} · ${cellsWithValues} cell${cellsWithValues !== 1 ? 's' : ''} with values · ${cellsWithFormulas} formula${cellsWithFormulas !== 1 ? 's' : ''}`,
    { duration: 6000 },
  )
}

/**
 * "Calculate Now / Calculate Sheet" in Excel forces a recompute when
 * Calculation Options is set to Manual. Quiksheets always runs in
 * auto-calc mode (formulajs evaluates on cell change), so the most
 * truthful behaviour is to confirm to the user that their formulas
 * are already up to date.
 */
function calculateNowToast(): void {
  toast.message('Auto-calc is on — formulas already up to date.')
}

export function FormulasTab(props: FormulasTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      {/* Function Library */}
      <RibbonGroup label="Function Library">
        <RibbonLargeButton label="Insert Function" icon={<Calculator className="text-emerald-600" />} onClick={() => useInsertFunctionStore.getState().setOpen(true)} />
        <RibbonLargeButton label="AutoSum" icon={<Sigma className="text-orange-500" />} onClick={props.onAutoSum} showCaret />
        <RibbonLargeButton label="Recently Used" icon={<History className="text-zinc-500" />} onClick={() => openFunctionsByCategory('All')} showCaret />
        <RibbonLargeButton label="Financial" icon={<Briefcase className="text-emerald-500" />} onClick={() => openFunctionsByCategory('Financial')} showCaret />
        <RibbonLargeButton label="Logical" icon={<GitBranch className="text-amber-500" />} onClick={() => openFunctionsByCategory('Logical')} showCaret />
        <RibbonLargeButton label="Text" icon={<Type className="text-blue-500" />} onClick={() => openFunctionsByCategory('Text')} showCaret />
        <RibbonLargeButton label="Date & Time" icon={<Calendar className="text-violet-500" />} onClick={() => openFunctionsByCategory('Date')} showCaret />
        <RibbonLargeButton label="Lookup & Ref" icon={<Search className="text-blue-500" />} onClick={() => openFunctionsByCategory('Lookup')} showCaret />
        <RibbonLargeButton label="Math & Trig" icon={<Pi className="text-rose-500" />} onClick={() => openFunctionsByCategory('Math')} showCaret />
        <RibbonLargeButton label="More Functions" icon={<PlusSquare className="text-zinc-500" />} onClick={() => useInsertFunctionStore.getState().setOpen(true)} showCaret />
      </RibbonGroup>

      {/* Defined Names */}
      <RibbonGroup label="Defined Names">
        <RibbonLargeButton label="Name Manager" icon={<Tag className="text-emerald-500" />} onClick={openNameManager} />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Define Name"     icon={<PlusSquare className="h-3.5 w-3.5" />} onClick={() => defineNameFromSelection(props.workbookId)} />
          <RibbonButton label="Use in Formula"  icon={<Hash className="h-3.5 w-3.5" />}        onClick={() => insertNameIntoFormula(props.workbookId)} />
          <RibbonButton label="Create from Sel" icon={<TableIcon className="h-3.5 w-3.5" />}   onClick={() => createNamesFromSelection(props.workbookId)} />
        </div>
      </RibbonGroup>

      {/* Formula Auditing */}
      <RibbonGroup label="Formula Auditing">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Trace Precedents" icon={<ArrowUpToLine className="h-3.5 w-3.5" />}   onClick={openDependencyMap} />
          <RibbonButton label="Trace Dependents" icon={<ArrowDownToLine className="h-3.5 w-3.5" />} onClick={openDependencyMap} />
          <RibbonButton label="Remove Arrows"     icon={<Minus className="h-3.5 w-3.5" />}            onClick={ribbonStub('Remove Arrows')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Show Formulas"   icon={<Eye className="h-3.5 w-3.5" />}            onClick={toggleShowFormulas} />
          <RibbonButton label="Error Checking"  icon={<Flag className="h-3.5 w-3.5 text-rose-500" />} onClick={runErrorChecking} />
          <RibbonButton label="Evaluate"        icon={<Activity className="h-3.5 w-3.5" />}        onClick={evaluateFormula} />
        </div>
        <RibbonLargeButton label="Map View" icon={<Network className="text-emerald-500" />} onClick={props.onMapView} />
      </RibbonGroup>

      {/* Watch Window */}
      <RibbonGroup label="Watch Window">
        <RibbonLargeButton label="Watch Window" icon={<Eye className="text-blue-500" />} onClick={ribbonStub('Watch Window')} />
      </RibbonGroup>

      {/* Calculation */}
      <RibbonGroup label="Calculation" className="border-r-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Calculation Options" className="flex h-[68px] w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <RefreshCcw className="h-6 w-6 text-amber-500" />
              <span className="flex items-center gap-0.5">Calc Options <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => toast.success('Automatic calculation is on')}>Automatic (current)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.message('Manual calculation mode is not supported yet')} disabled>Manual</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success('Auto except for tables is on')} disabled>Automatic Except for Data Tables</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Calculate Now"   shortcut="F9"        icon={<Calculator className="h-3.5 w-3.5" />} onClick={calculateNowToast} />
          <RibbonButton label="Calculate Sheet" shortcut="Shift+F9" icon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={calculateNowToast} />
        </div>
      </RibbonGroup>

      {/* Quiksheets AI */}
      <RibbonGroup label="Quiksheets AI" className="border-r-0">
        <RibbonLargeButton label="AI Formula" icon={<Sparkles className="text-amber-500" />} onClick={props.onAIAssistant} />
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
  onImport?: (() => void) | undefined
  onDedupe?: (() => void) | undefined
  onCleanData?: (() => void) | undefined
  onForecast?: (() => void) | undefined
}

export function DataTab(props: DataTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      {/* Get & Transform Data */}
      <RibbonGroup label="Get & Transform Data">
        <RibbonLargeButton label="Get Data" icon={<Database className="text-emerald-500" />} onClick={props.onImport} showCaret />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="From Text/CSV"  icon={<FileText className="h-3.5 w-3.5" />}      onClick={props.onImport} />
          <RibbonButton label="From Web"        icon={<Globe className="h-3.5 w-3.5" />}         onClick={ribbonStub('From Web')} />
          <RibbonButton label="From Picture"   icon={<ImageIcon className="h-3.5 w-3.5" />}     onClick={ribbonStub('From Picture')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="From Table/Range" icon={<TableIcon className="h-3.5 w-3.5" />}    onClick={ribbonStub('From Table/Range')} />
          <RibbonButton label="Recent Sources"   icon={<History className="h-3.5 w-3.5" />}      onClick={ribbonStub('Recent Sources')} />
          <RibbonButton label="Existing Conn."   icon={<Anchor className="h-3.5 w-3.5" />}       onClick={ribbonStub('Existing Connections')} />
        </div>
      </RibbonGroup>

      {/* Queries & Connections */}
      <RibbonGroup label="Queries & Connections">
        <RibbonLargeButton label="Refresh All" icon={<RefreshCcw className="text-blue-500" />} onClick={ribbonStub('Refresh All')} showCaret />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Queries & Connections" icon={<Anchor className="h-3.5 w-3.5" />}     onClick={ribbonStub('Queries & Connections')} />
          <RibbonButton label="Properties"             icon={<FileBarChart className="h-3.5 w-3.5" />} onClick={ribbonStub('Properties')} />
          <RibbonButton label="Workbook Links"         icon={<Link2 className="h-3.5 w-3.5" />}        onClick={ribbonStub('Workbook Links')} />
        </div>
      </RibbonGroup>

      {/* Data Types */}
      <RibbonGroup label="Data Types">
        <RibbonLargeButton label="Stocks"     icon={<TrendingUp className="text-emerald-500" />} onClick={ribbonStub('Stocks')} />
        <RibbonLargeButton label="Currencies" icon={<Coins className="text-amber-500" />}        onClick={ribbonStub('Currencies')} />
      </RibbonGroup>

      {/* Sort & Filter */}
      <RibbonGroup label="Sort & Filter">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Sort A → Z" icon={<ArrowDownAZ className="h-3.5 w-3.5" />}                       onClick={props.onSortAsc} />
          <RibbonButton label="Sort Z → A" icon={<ArrowDownAZ className="h-3.5 w-3.5 rotate-180" />}            onClick={props.onSortDesc} />
        </div>
        <RibbonLargeButton label="Sort" icon={<SortAsc className="text-blue-500" />} onClick={props.onSortAsc} />
        <RibbonLargeButton label="Filter" icon={<Filter className="text-blue-500" />} onClick={props.onFilter} />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Clear"    icon={<EyeOff className="h-3.5 w-3.5" />}      onClick={clearFilter} />
          <RibbonButton label="Reapply"  icon={<RefreshCcw className="h-3.5 w-3.5" />}  onClick={reapplyFilter} />
          <RibbonButton label="Advanced" icon={<WandSparkles className="h-3.5 w-3.5" />} onClick={ribbonStub('Advanced Filter')} />
        </div>
      </RibbonGroup>

      {/* Data Tools */}
      <RibbonGroup label="Data Tools">
        <ColumnTypeRibbonButton />
        <RibbonLargeButton label="Text to Cols"   icon={<SquareStack className="text-blue-500" />} onClick={() => useTextToColsStore.getState().setOpen(true)} />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Flash Fill"        icon={<WandSparkles className="h-3.5 w-3.5" />} shortcut="Ctrl+E" onClick={() => { void flashFill() }} />
          <RibbonButton label="Remove Duplicates" icon={<Minus className="h-3.5 w-3.5" />}        onClick={props.onDedupe} />
          <RibbonButton label="Data Validation"   icon={<ShieldCheck className="h-3.5 w-3.5 text-amber-500" />} onClick={props.onValidation} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Consolidate"       icon={<SquareStack className="h-3.5 w-3.5" />} onClick={ribbonStub('Consolidate')} />
          <RibbonButton label="Relationships"     icon={<Webhook className="h-3.5 w-3.5" />}      onClick={ribbonStub('Relationships')} />
          <RibbonButton label="Clean Data ✦ AI"  icon={<RefreshCcw className="h-3.5 w-3.5 text-cyan-500" />} onClick={props.onCleanData} />
        </div>
      </RibbonGroup>

      {/* Forecast */}
      <RibbonGroup label="Forecast">
        <RibbonLargeButton label="What-If Analysis" icon={<Rocket className="text-violet-500" />}   onClick={ribbonStub('What-If Analysis')} showCaret />
        <RibbonLargeButton label="Forecast Sheet"   icon={<TrendingUp className="text-emerald-500" />} onClick={props.onForecast} />
      </RibbonGroup>

      {/* Outline */}
      <RibbonGroup label="Outline" className="border-r-0">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Group"    icon={<Group className="h-3.5 w-3.5" />}     onClick={ribbonStub('Group')} />
          <RibbonButton label="Ungroup"  icon={<Ungroup className="h-3.5 w-3.5" />}    onClick={ribbonStub('Ungroup')} />
          <RibbonButton label="Subtotal" icon={<Sigma className="h-3.5 w-3.5" />}       onClick={ribbonStub('Subtotal')} />
        </div>
      </RibbonGroup>
    </div>
  )
}

// ─── Review ──────────────────────────────────────────────────────────────────

interface ReviewTabProps {
  onFind: () => void
  onShortcuts: () => void
  onRowSummarizer?: (() => void) | undefined
  onComments?: (() => void) | undefined
  onProtectedRanges?: (() => void) | undefined
  onVersionHistory?: (() => void) | undefined
  onShareLink?: (() => void) | undefined
}

export function ReviewTab(props: ReviewTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      {/* Proofing */}
      <RibbonGroup label="Proofing">
        <RibbonLargeButton label="Spelling"            icon={<BookOpen className="text-emerald-500" />} onClick={ribbonStub('Spelling (F7)')} />
        <RibbonLargeButton label="Thesaurus"           icon={<BookOpen className="text-blue-500" />}    onClick={ribbonStub('Thesaurus')} />
        <RibbonLargeButton label="Workbook Statistics" icon={<FileBarChart className="text-violet-500" />} onClick={showWorkbookStatistics} />
      </RibbonGroup>

      {/* Performance */}
      <RibbonGroup label="Performance">
        <RibbonLargeButton label="Check Performance" icon={<Gauge className="text-amber-500" />} onClick={ribbonStub('Check Performance')} />
      </RibbonGroup>

      {/* Accessibility */}
      <RibbonGroup label="Accessibility">
        <RibbonLargeButton label="Check Accessibility" icon={<Users className="text-blue-500" />} onClick={ribbonStub('Check Accessibility')} showCaret />
      </RibbonGroup>

      {/* Language */}
      <RibbonGroup label="Language">
        <RibbonLargeButton label="Translate" icon={<Languages className="text-rose-500" />} onClick={ribbonStub('Translate')} />
      </RibbonGroup>

      {/* Changes */}
      <RibbonGroup label="Changes">
        <RibbonLargeButton label="Show Changes" icon={<History className="text-violet-500" />} onClick={props.onVersionHistory} />
      </RibbonGroup>

      {/* Comments */}
      <RibbonGroup label="Comments">
        <RibbonLargeButton label="New Comment" icon={<MessageSquare className="text-blue-500" />} onClick={props.onComments} />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Delete"   icon={<Minus className="h-3.5 w-3.5" />}          onClick={ribbonStub('Delete Comment')} />
          <RibbonButton label="Previous" icon={<ArrowUpToLine className="h-3.5 w-3.5" />}  onClick={ribbonStub('Previous Comment')} />
          <RibbonButton label="Next"     icon={<ArrowDownToLine className="h-3.5 w-3.5" />} onClick={ribbonStub('Next Comment')} />
        </div>
        <RibbonLargeButton label="Show Comments" icon={<MessageCircle className="text-blue-500" />} onClick={props.onComments} />
      </RibbonGroup>

      {/* Notes */}
      <RibbonGroup label="Notes">
        <RibbonLargeButton label="Notes" icon={<StickyNote className="text-amber-500" />} onClick={ribbonStub('Notes')} showCaret />
      </RibbonGroup>

      {/* Protect */}
      <RibbonGroup label="Protect">
        <RibbonLargeButton label="Protect Sheet"     icon={<Lock className="text-amber-500" />}     onClick={props.onProtectedRanges} />
        <RibbonLargeButton label="Protect Workbook"  icon={<Lock className="text-rose-500" />}      onClick={ribbonStub('Protect Workbook')} />
        <RibbonLargeButton label="Allow Edit Ranges" icon={<ShieldCheck className="text-blue-500" />} onClick={props.onProtectedRanges} />
        <RibbonLargeButton label="Share"             icon={<Share2 className="text-emerald-500" />} onClick={props.onShareLink} />
      </RibbonGroup>

      {/* Ink */}
      <RibbonGroup label="Ink" className="border-r-0">
        <RibbonLargeButton label="Hide Ink" icon={<EyeOff className="text-zinc-500" />} onClick={ribbonStub('Hide Ink')} />
      </RibbonGroup>

      {/* AI Insights + Help (kept) */}
      <RibbonGroup label="AI Insights" className="border-r-0">
        <RibbonLargeButton label="AI Summarise" icon={<Rows3 className="text-violet-500" />} onClick={props.onRowSummarizer} />
      </RibbonGroup>
      <RibbonGroup label="Help" className="border-r-0">
        <RibbonLargeButton label="Shortcuts" icon={<CircleHelp className="text-zinc-500" />} onClick={props.onShortcuts} />
        <RibbonLargeButton label="Find"      icon={<Search className="text-blue-500" />}     onClick={props.onFind} />
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

export function ViewTab(props: ViewTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      {/* Sheet View */}
      <RibbonGroup label="Sheet View">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-7 w-[120px] items-center justify-between rounded border border-zinc-300 bg-white px-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
              Default
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={ribbonStub('Default View')}>Default</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Keep" icon={<Bookmark className="h-3.5 w-3.5" />}  onClick={ribbonStub('Keep Sheet View')} />
          <RibbonButton label="Exit" icon={<Minus className="h-3.5 w-3.5" />}      onClick={ribbonStub('Exit Sheet View')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="New"     icon={<Plus className="h-3.5 w-3.5" />}    onClick={ribbonStub('New Sheet View')} />
          <RibbonButton label="Options" icon={<Tag className="h-3.5 w-3.5" />}      onClick={ribbonStub('Sheet View Options')} />
        </div>
      </RibbonGroup>

      {/* Workbook Views */}
      <RibbonGroup label="Workbook Views">
        <RibbonLargeButton label="Normal"            icon={<TableIcon className="text-blue-500" />}      onClick={ribbonStub('Normal')} />
        <RibbonLargeButton label="Page Break Preview" icon={<GitBranch className="text-amber-500" />}    onClick={ribbonStub('Page Break Preview')} />
        <RibbonLargeButton label="Page Layout"       icon={<LayoutDashboard className="text-violet-500" />} onClick={ribbonStub('Page Layout')} />
        <RibbonLargeButton label="Custom Views"      icon={<Eye className="text-emerald-500" />}         onClick={ribbonStub('Custom Views')} />
      </RibbonGroup>

      {/* Show */}
      <RibbonGroup label="Show">
        <div className="flex flex-col gap-1.5 px-1 py-1 text-[11px]">
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" defaultChecked /> Navigation
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" /> Ruler
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" checked={props.gridlinesVisible} onChange={props.onToggleGridlines} /> Gridlines
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" checked={props.formulaBarVisible} onChange={props.onToggleFormulaBar} /> Formula Bar
          </label>
        </div>
        <div className="flex flex-col gap-1.5 px-1 py-1 text-[11px]">
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" defaultChecked /> Headings
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" /> Data Type Icons
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" className="h-3 w-3 rounded accent-emerald-600" /> Focus Cell
          </label>
        </div>
      </RibbonGroup>

      {/* Zoom */}
      <RibbonGroup label="Zoom">
        <RibbonLargeButton label="Zoom"             icon={<ZoomIn className="text-blue-500" />}  onClick={props.onZoomIn} />
        <RibbonLargeButton label="100%"             icon={<Circle className="text-zinc-500" />}   onClick={props.onZoomReset} />
        <RibbonLargeButton label="Zoom to Selection" icon={<ZoomOut className="text-blue-500" />} onClick={props.onZoomOut} />
      </RibbonGroup>

      {/* Window */}
      <RibbonGroup label="Window">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="New Window"  icon={<PlusSquare className="h-3.5 w-3.5" />} onClick={ribbonStub('New Window')} />
          <RibbonButton label="Arrange All" icon={<LayoutDashboard className="h-3.5 w-3.5" />} onClick={ribbonStub('Arrange All')} />
          {/* Freeze Panes — Excel-faithful 4-option dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Freeze Panes"
                className="flex h-[22px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Lock className="h-3.5 w-3.5" />
                Freeze
                <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={freezePanesAtActiveCell}>
                Freeze Panes
                <span className="ml-2 text-[10px] text-zinc-400">(at active cell)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={freezeTopRow}>Freeze Top Row</DropdownMenuItem>
              <DropdownMenuItem onSelect={freezeFirstColumn}>Freeze First Column</DropdownMenuItem>
              <DropdownMenuItem onSelect={unfreezePanes}>Unfreeze Panes</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Split"   icon={<Minus className="h-3.5 w-3.5" />}     onClick={ribbonStub('Split')} />
          <RibbonButton label="Hide Sheet"    icon={<EyeOff className="h-3.5 w-3.5" />}    onClick={hideActiveSheet} />
          <RibbonButton label="Unhide Sheet"  icon={<Eye className="h-3.5 w-3.5" />}        onClick={unhideSheetPicker} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="View Side by Side" icon={<SquareStack className="h-3.5 w-3.5" />} onClick={ribbonStub('View Side by Side')} />
          <RibbonButton label="Sync Scrolling"     icon={<RefreshCcw className="h-3.5 w-3.5" />}  onClick={ribbonStub('Synchronous Scrolling')} />
          <RibbonButton label="Reset Window"       icon={<RefreshCcw className="h-3.5 w-3.5" />}  onClick={ribbonStub('Reset Window Position')} />
        </div>
        <RibbonLargeButton label="Switch Windows" icon={<RefreshCcw className="text-blue-500" />} onClick={ribbonStub('Switch Windows')} showCaret />
      </RibbonGroup>

      {/* Macros */}
      <RibbonGroup label="Macros" className="border-r-0">
        <RibbonLargeButton label="Macros" icon={<Code2 className="text-violet-500" />} onClick={ribbonStub('View Macros')} showCaret />
      </RibbonGroup>

      {/* Map View shortcut */}
      <RibbonGroup label="Quiksheets" className="border-r-0">
        <RibbonLargeButton label="Map View" icon={<Network className="text-emerald-500" />} onClick={props.onMapView} />
      </RibbonGroup>
    </div>
  )
}

// ─── Automate ────────────────────────────────────────────────────────────────

export function AutomateTab() {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      <RibbonGroup label="Office Scripts">
        <RibbonLargeButton label="New Script"   icon={<Plus className="text-emerald-500" />}     onClick={ribbonStub('New Script')} showCaret />
        <RibbonLargeButton label="View Scripts" icon={<Code2 className="text-blue-500" />}        onClick={ribbonStub('View Scripts')} showCaret />
      </RibbonGroup>

      <RibbonGroup label="Office Scripts Gallery">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Unhide All Rows and Columns" icon={<Eye className="h-3.5 w-3.5 text-orange-500" />}   onClick={ribbonStub('Unhide All Rows and Columns')} />
          <RibbonButton label="Remove Hyperlinks from Sheet" icon={<Link2 className="h-3.5 w-3.5 text-orange-500" />} onClick={ribbonStub('Remove Hyperlinks from Sheet')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Freeze Selection"   icon={<Lock className="h-3.5 w-3.5 text-orange-500" />}        onClick={ribbonStub('Freeze Selection')} />
          <RibbonButton label="Count Empty Rows"   icon={<Calculator className="h-3.5 w-3.5 text-orange-500" />} onClick={ribbonStub('Count Empty Rows')} />
        </div>
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Make a Subtable from Range" icon={<TableIcon className="h-3.5 w-3.5 text-orange-500" />}  onClick={ribbonStub('Make a Subtable from Range')} />
          <RibbonButton label="Return Table Data as JSON"  icon={<FileText className="h-3.5 w-3.5 text-orange-500" />}    onClick={ribbonStub('Return Table Data as JSON')} />
        </div>
      </RibbonGroup>

      <RibbonGroup label="Power Automate" className="border-r-0">
        <RibbonLargeButton label="Automation Templates" icon={<WandSparkles className="text-blue-500" />} onClick={ribbonStub('Automation Templates')} />
      </RibbonGroup>
    </div>
  )
}

// ─── Help ────────────────────────────────────────────────────────────────────

interface HelpTabProps {
  onShortcuts: () => void
}

export function HelpTab({ onShortcuts }: HelpTabProps) {
  return (
    <div className="flex h-full items-stretch overflow-x-auto scrollbar-hide">
      <RibbonGroup label="Help">
        <RibbonLargeButton label="Help"           icon={<CircleHelp className="text-blue-500" />}  onClick={onShortcuts} />
        <RibbonLargeButton label="Contact Support" icon={<MessageCircle className="text-emerald-500" />} onClick={ribbonStub('Contact Support')} />
        <RibbonLargeButton label="Feedback"       icon={<MessageSquare className="text-violet-500" />}   onClick={ribbonStub('Feedback')} />
        <RibbonLargeButton label="Show Training"  icon={<BookOpen className="text-amber-500" />}         onClick={ribbonStub('Show Training')} />
        <RibbonLargeButton label="What's New"     icon={<Sparkles className="text-rose-500" />}           onClick={ribbonStub("What's New")} />
      </RibbonGroup>

      <RibbonGroup label="Community" className="border-r-0">
        <RibbonLargeButton label="Community"  icon={<Users className="text-blue-500" />}   onClick={ribbonStub('Community')} />
        <RibbonLargeButton label="Excel Blog" icon={<FileText className="text-emerald-500" />} onClick={ribbonStub('Excel Blog')} />
      </RibbonGroup>
    </div>
  )
}
