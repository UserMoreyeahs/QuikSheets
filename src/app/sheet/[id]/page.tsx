'use client'

// Patch @formulajs/formulajs with modern Excel functions (XLOOKUP, FILTER, etc.).
// Must run BEFORE FortuneSheet's dynamic import resolves so its formula parser
// picks up the new functions.
import '@/lib/formulajsPatches'

import { useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { Network, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { CommandPalette, type CommandPaletteItem } from '@/components/CommandPalette'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { ThemeToggle } from '@/components/ThemeToggle'
import { WorkbookSidebar } from '@/features/workbook/components/WorkbookSidebar'
import { createWorkbookAction } from '@/features/workbook/actions'
import { getBrowserSupabase } from '@/lib/supabase/client'
import {
  createSheetFromImportedData,
  createSheetFromImportedDataWithFidelity,
  getCellFormulaBarValue,
  getCellFromSheet,
  getCellDisplayValue,
  getSheetMatrix,
  isSheetEmpty,
} from '@/lib/fortuneSheet'
import { createDefaultSheet } from '@/lib/defaultSheet'
import { SpreadsheetGrid } from '@/features/grid'
import { FormulaBar } from '@/features/formula-bar'
import { useFormattingShortcuts } from '@/features/toolbar'
import { useExcelKeyboardShortcuts } from '@/features/toolbar/hooks/useExcelKeyboardShortcuts'
import { Ribbon } from '@/features/ribbon/components/Ribbon'
import { StatusBar } from '@/features/ribbon/components/StatusBar'
import { SheetTabsBar } from '@/features/sheets'
import { SortPanel } from '@/features/grid/components/SortPanel'
import { FilterPanel } from '@/features/grid/components/FilterPanel'
import { FindReplace } from '@/features/grid/components/FindReplace'
import { DataValidation } from '@/features/grid/components/DataValidation'
import { ImportModal } from '@/features/grid/components/ImportModal'
import { ExportMenu } from '@/features/grid/components/ExportMenu'
import { SaveStatus } from '@/features/grid/components/SaveStatus'
import { exportToCSV, exportToExcelFidelity, exportToPDF } from '@/features/grid/utils/exportUtils'
import { buildExportExtras } from '@/features/grid/utils/exportExtrasAdapter'
// Lazy-loaded heavy panels — these render only when their respective UI
// stores have `open: true`, so deferring their JS bundle keeps the initial
// /sheet/[id] payload lean. Each `next/dynamic` import is split into its
// own chunk fetched on demand.
import { useDependencyMap, type DependencyMapCellTarget } from '@/features/dependency-map'
const DependencyMap = dynamic(
  () => import('@/features/dependency-map').then((m) => ({ default: m.DependencyMap })),
  { ssr: false },
)
import { useCellHistory } from '@/features/cell-history'
const CellHistoryPanel = dynamic(
  () => import('@/features/cell-history').then((m) => ({ default: m.CellHistoryPanel })),
  { ssr: false },
)
import { NLFilterBar, type NLFilterColumnSchema, type NLFilterSampleRow } from '@/features/nl-filter'
import { useNLFilterUiStore } from '@/features/nl-filter/store/nlFilterUiStore'
import { useColumnDNA } from '@/features/column-dna'
import { useTypedColumnsEnforcement } from '@/features/typed-columns'
const ColumnDNAPanel = dynamic(
  () => import('@/features/column-dna').then((m) => ({ default: m.ColumnDNAPanel })),
  { ssr: false },
)
import { ScratchpadToggle, useScratchpad } from '@/features/scratchpad'
const ScratchpadPanel = dynamic(
  () => import('@/features/scratchpad').then((m) => ({ default: m.ScratchpadPanel })),
  { ssr: false },
)
import { RowSummarizer, useRowSummarizer } from '@/features/row-summarizer'
import { applyAllCFRules } from '@/features/conditional-formatting'
const ConditionalFormatting = dynamic(
  () => import('@/features/conditional-formatting').then((m) => ({ default: m.ConditionalFormatting })),
  { ssr: false },
)
const InsertFunctionDialog = dynamic(
  () => import('@/features/formula-engine/components/InsertFunctionDialog').then((m) => ({ default: m.InsertFunctionDialog })),
  { ssr: false },
)
import { useInsertFunctionStore } from '@/features/formula-engine/stores/insertFunctionStore'
const NameManagerDialog = dynamic(
  () => import('@/features/named-ranges/NameManagerDialog').then((m) => ({ default: m.NameManagerDialog })),
  { ssr: false },
)
import { useNamedRangesStore } from '@/features/named-ranges/namedRangesStore'
import { useCFStore } from '@/features/conditional-formatting/store/cfStore'
import { applyRulesToSheet, evaluateRules } from '@/features/conditional-formatting/utils/cfEvaluator'
import * as cellOps from '@/features/ribbon/utils/cellOps'
import { installHyperlinkFollow } from '@/features/ribbon/utils/cellOps'
import { usePrintSettingsStore } from '@/features/page-layout/printSettingsStore'
const CleanDataPanel = dynamic(
  () => import('@/features/data-cleaning/components/CleanDataPanel').then((m) => ({ default: m.CleanDataPanel })),
  { ssr: false },
)
import { useCleanDataStore } from '@/features/data-cleaning/store/cleanDataStore'
const ChartBuilder = dynamic(
  () => import('@/features/charts/components/ChartBuilder').then((m) => ({ default: m.ChartBuilder })),
  { ssr: false },
)
const ChartsLayer = dynamic(
  () => import('@/features/charts/components/ChartsLayer').then((m) => ({ default: m.ChartsLayer })),
  { ssr: false },
)
const ImagesLayer = dynamic(
  () => import('@/features/images/components/ImagesLayer').then((m) => ({ default: m.ImagesLayer })),
  { ssr: false },
)
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
const SymbolPicker = dynamic(
  () => import('@/features/symbols/components/SymbolPicker').then((m) => ({ default: m.SymbolPicker })),
  { ssr: false },
)
const TextToColumnsDialog = dynamic(
  () => import('@/features/data/components/TextToColumnsDialog').then((m) => ({ default: m.TextToColumnsDialog })),
  { ssr: false },
)
import { useTextToColsStore } from '@/features/data/store/textToColsStore'
const FormBuilder = dynamic(
  () => import('@/features/forms/components/FormBuilder').then((m) => ({ default: m.FormBuilder })),
  { ssr: false },
)
import { useFormBuilderStore } from '@/features/forms/store/formBuilderStore'
const PivotBuilder = dynamic(
  () => import('@/features/pivot/components/PivotBuilder').then((m) => ({ default: m.PivotBuilder })),
  { ssr: false },
)
const PivotsLayer = dynamic(
  () => import('@/features/pivot/components/PivotsLayer').then((m) => ({ default: m.PivotsLayer })),
  { ssr: false },
)
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import { SlicersLayer } from '@/features/slicers/components/SlicersLayer'
import { FillHandle } from '@/features/drag-fill/components/FillHandle'
import { RemoteCursors, PresenceAvatars } from '@/features/collab/components/RemoteCursors'
import { useRealtimeCollab } from '@/features/collab/hooks/useRealtimeCollab'
const ForecastPanel = dynamic(
  () => import('@/features/forecasting/components/ForecastPanel').then((m) => ({ default: m.ForecastPanel })),
  { ssr: false },
)
import { useForecastStore } from '@/features/forecasting/store/forecastStore'
const CommentsPanel = dynamic(
  () => import('@/features/comments/components/CommentsPanel').then((m) => ({ default: m.CommentsPanel })),
  { ssr: false },
)
const CommentComposer = dynamic(
  () => import('@/features/comments/components/CommentComposer').then((m) => ({ default: m.CommentComposer })),
  { ssr: false },
)
import { useCommentsUiStore } from '@/features/comments/store/commentsUiStore'
// Server-backed version history (Supabase workbook_versions table).
// The legacy LocalVersionHistoryPanel stays in the codebase as an
// offline fallback but is no longer rendered by the sheet page.
const VersionHistoryPanel = dynamic(
  () => import('@/features/version-history/components/VersionHistoryPanel').then((m) => ({ default: m.VersionHistoryPanel })),
  { ssr: false },
)
import { useVersionUiStore } from '@/features/version-history/store/versionUiStore'
const ShareDialog = dynamic(
  () => import('@/features/share-links/components/ShareDialog').then((m) => ({ default: m.ShareDialog })),
  { ssr: false },
)
import { useShareDialogStore } from '@/features/share-links/store/shareDialogStore'
const ProtectedRangesDialog = dynamic(
  () => import('@/features/protected-ranges/components/ProtectedRangesDialog').then((m) => ({ default: m.ProtectedRangesDialog })),
  { ssr: false },
)
import { useProtectedRangesUiStore } from '@/features/protected-ranges/store/protectedRangesUiStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { DEFAULT_COLS } from '@/lib/constants'
import { colIndexToLetter } from '@/lib/cellAddress'
import type { ImportedSheet } from '@/features/grid/utils/importUtils'
import type { ExportSheet } from '@/features/grid/utils/exportUtils'
import type { SheetTab, SortDirection } from '@/types/sheet.types'
import type { Sheet } from '@fortune-sheet/core'

function toExportRows(sheet?: Sheet): (string | number | boolean | null)[][] {
  if (!sheet) return []

  const matrix = getSheetMatrix(sheet)
  let lastRow = -1
  let lastCol = -1

  matrix.forEach((row, rowIndex) => {
    ;(row ?? []).forEach((cell, colIndex) => {
      const value = getCellDisplayValue(cell)
      if (value !== null && value !== '') {
        lastRow = Math.max(lastRow, rowIndex)
        lastCol = Math.max(lastCol, colIndex)
      }
    })
  })

  if (lastRow === -1 || lastCol === -1) return []

  return Array.from({ length: lastRow + 1 }, (_, rowIndex) =>
    Array.from({ length: lastCol + 1 }, (_, colIndex) => {
      const value = getCellDisplayValue(matrix[rowIndex]?.[colIndex] ?? null)
      return value ?? null
    })
  )
}

export default function SheetPage() {
  useFormattingShortcuts()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const workbookId = params.id

  const {
    gridSheets,
    gridInstance,
    replaceGridSheets,
    selectedCell,
    selectedRange,
    applySort,
    clearFilters,
    clearFormatOnSelection,
    setEditingCell,
    setFormulaBarValue,
    setSelectedCell,
    setSelectedRange,
    setShowFindReplace,
    setSkipNextTabSync,
  } = useSheetStore()
  const { sheets, activeSheetId, addSheet, replaceSheets, setActiveSheet: setActiveWorkbookSheet } =
    useWorkbookStore()
  const { showMap, setShowMap, toggleMap } = useDependencyMap()
  const cellHistory = useCellHistory(workbookId)
  const collab = useRealtimeCollab(workbookId)
  // Hydrate typed-column metadata for this workbook and re-format
  // displayed values when columns get a new type assigned.
  useTypedColumnsEnforcement(workbookId)

  // Hoist dialog-open flags to the component top level so the hook calls
  // always execute in a stable order and are never inside JSX expressions.
  const insertFunctionOpen = useInsertFunctionStore((s) => s.open)
  const textToColsOpen = useTextToColsStore((s) => s.open)
  const nameManagerOpen = useNamedRangesStore((s) => s.dialogOpen)

  // Broadcast cursor position to other users via Realtime.
  // Use collab.broadcastCursor directly (stable useCallback ref) — do NOT
  // include the whole `collab` object (recreated every render → infinite loop).
  const { broadcastCursor } = collab
  useEffect(() => {
    if (selectedCell && activeSheetId) {
      broadcastCursor(activeSheetId, selectedCell.row, selectedCell.col)
    }
  }, [selectedCell, activeSheetId, broadcastCursor])

  const [showSort, setShowSort] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCF, setShowCF] = useState(false)
  // Sidebar starts expanded on BOTH server and client so the initial
  // hydration markup matches. Without this guarantee Next.js logs a
  // "hydration failed" recoverable error because window.innerWidth is
  // only defined on the client. After mount we sync to the user's saved
  // preference (or auto-collapse on narrow viewports).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  useEffect(() => {
    // 1) Honour an explicit user preference if present.
    try {
      const saved = window.localStorage.getItem('quiksheets_sidebar_collapsed')
      if (saved === '1') {
        setSidebarCollapsed(true)
        return
      }
      if (saved === '0') {
        setSidebarCollapsed(false)
        return
      }
    } catch {
      // localStorage unavailable — fall through to viewport heuristic.
    }
    // 2) No preference: collapse on narrow viewports.
    if (window.innerWidth < 768) setSidebarCollapsed(true)
  }, [])
  // Auto-collapse the sidebar on viewport resize crossing the breakpoint.
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768) setSidebarCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Persist the user's choice so it carries across reloads / new tabs.
  useEffect(() => {
    try {
      window.localStorage.setItem('quiksheets_sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  // Install Ctrl+Click hyperlink-follow on the canvas. Idempotent.
  useEffect(() => {
    installHyperlinkFollow()
  }, [])

  // Listen for quiksheets:toggle-map (fired by Trace Precedents/Dependents).
  // Routed through a CustomEvent so cellOps doesn't need a direct dependency
  // on the page-component's state.
  useEffect(() => {
    function handle() { toggleMap() }
    window.addEventListener('quiksheets:toggle-map', handle)
    return () => window.removeEventListener('quiksheets:toggle-map', handle)
  }, [toggleMap])

  // UX-1: NL filter bar visibility + Ctrl+Shift+L shortcut to toggle.
  const nlFilterVisible = useNLFilterUiStore((s) => s.visible)
  const toggleNlFilter = useNLFilterUiStore((s) => s.toggle)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        toggleNlFilter()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleNlFilter])

  // Dev-only: expose the live grid instance + a 2-D test-data seeder on
  // window so we can verify Insert > Chart/Table/Pivot end-to-end with
  // real data. Stripped from production bundles.
  //
  // The seeder writes directly into gridSheets via replaceGridSheets so
  // both FortuneSheet AND the Zustand mirror (which ChartsLayer / PivotsLayer
  // read from) end up in sync — calling FortuneSheet's setCellValue alone
  // updates the canvas but doesn't always fire onChange in time.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    ;(window as unknown as { __qsGrid?: unknown }).__qsGrid = gridInstance
    ;(window as unknown as { __qsSeed?: (rows: unknown[][]) => void }).__qsSeed = (rows) => {
      const state = useSheetStore.getState()
      const sheets = state.gridSheets.length ? state.gridSheets : [{ id: activeSheetId, name: 'Sheet1', status: 1 }]
      const targetSheetIdx = Math.max(0, sheets.findIndex((s) => s.status === 1))
      const target = sheets[targetSheetIdx]
      if (!target) {
        console.warn('[qs] no active sheet to seed')
        return
      }
      const buildCell = (v: unknown) =>
        v === null || v === undefined
          ? null
          : typeof v === 'number'
            ? { ct: { fa: 'General', t: 'n' }, m: String(v), v }
            : { ct: { fa: 'General', t: 'g' }, m: String(v), v: String(v) }
      const celldata = rows.flatMap((row, r) =>
        row.map((v, c) => ({ r, c, v: buildCell(v) })).filter((e) => e.v !== null),
      )
      // Also populate the 2-D `data` matrix because FortuneSheet renders
      // from `data`, not celldata, when the workbook is hydrated via the
      // `data` prop. Build a 100x26 matrix (default sheet size).
      const ROWS = 100
      const COLS = 26
      const matrix: (ReturnType<typeof buildCell> | null)[][] = Array.from(
        { length: ROWS },
        () => Array<ReturnType<typeof buildCell> | null>(COLS).fill(null),
      )
      rows.forEach((row, r) => {
        if (r >= ROWS) return
        row.forEach((v, c) => {
          if (c >= COLS) return
          matrix[r]![c] = buildCell(v)
        })
      })
      const nextSheets = sheets.map((s, i) =>
        i === targetSheetIdx
          ? ({ ...s, celldata, data: matrix } as typeof s)
          : s,
      )
      state.replaceGridSheets(nextSheets)
    }
    // Dev helpers for the typed-columns store — used to verify the
    // enforcement hook reverts cells correctly when a column type is
    // cleared. Reaches into the same store the picker chips use.
    ;(window as unknown as { __qsSetColType?: (sheetId: string, col: number, type: string) => void }).__qsSetColType =
      (sheetId, col, type) => {
        const { useColumnTypesStore } = require('@/features/typed-columns/store/columnTypesStore') as typeof import('@/features/typed-columns/store/columnTypesStore')
        useColumnTypesStore.getState().setColumnType(sheetId, col, { type: type as never })
      }
    ;(window as unknown as { __qsClearColType?: (sheetId: string, col: number) => void }).__qsClearColType =
      (sheetId, col) => {
        const { useColumnTypesStore } = require('@/features/typed-columns/store/columnTypesStore') as typeof import('@/features/typed-columns/store/columnTypesStore')
        useColumnTypesStore.getState().clearColumnType(sheetId, col)
      }
    // Named-ranges helper — define a name programmatically (skips the
    // window.prompt() in defineNameFromSelection so we can test the
    // store / Name Manager without UI driver flakiness).
    ;(window as unknown as { __qsAddName?: (name: string, range: string) => void }).__qsAddName =
      (name, range) => {
        const { useNamedRangesStore } = require('@/features/named-ranges/namedRangesStore') as typeof import('@/features/named-ranges/namedRangesStore')
        useNamedRangesStore.getState().addName(workbookId, { name, range, scope: 'workbook' })
      }
    ;(window as unknown as { __qsListNames?: () => Array<{ name: string; range: string }> }).__qsListNames = () => {
      const { useNamedRangesStore } = require('@/features/named-ranges/namedRangesStore') as typeof import('@/features/named-ranges/namedRangesStore')
      return useNamedRangesStore.getState().getNamesForWorkbook(workbookId) as unknown as Array<{ name: string; range: string }>
    }
    // Filter helper — add a single equals-filter on a column.
    ;(window as unknown as { __qsAddFilter?: (col: number, operator: string, value: string) => void }).__qsAddFilter =
      (col, operator, value) => {
        const state = useSheetStore.getState()
        state.addFilter({ columnIndex: col, operator: operator as never, value })
      }
    ;(window as unknown as { __qsClearFilters?: () => void }).__qsClearFilters = () => {
      useSheetStore.getState().clearFilters()
    }
    // CF helper — add a "highlight cells > value" rule and re-apply.
    ;(window as unknown as { __qsAddCFGreaterThan?: (sheetId: string, range: string, threshold: number, bgColor: string) => void }).__qsAddCFGreaterThan =
      (sheetId, range, threshold, bgColor) => {
        const { useCFStore } = require('@/features/conditional-formatting/store/cfStore') as typeof import('@/features/conditional-formatting/store/cfStore')
        useCFStore.getState().addRule(sheetId, {
          range,
          condition: { type: 'cell_value', operator: 'greater', value: String(threshold) },
          format: { fill: bgColor },
          priority: 0,
        })
        useCFStore.getState().applyToActiveSheet()
      }
  }, [gridInstance, activeSheetId])
  const [showFormulaBarUI, setShowFormulaBarUI] = useState(true)
  const [showGridlines, setShowGridlines] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [workbookName, setWorkbookName] = useState(() =>
    workbookId === 'demo' ? 'Demo Spreadsheet' : `Workbook ${workbookId.slice(0, 8)}`
  )
  const [isEditingName, setIsEditingName] = useState(false)

  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId)
  const activeGridSheet = gridSheets.find((sheet) => sheet.id === activeSheetId) ?? gridSheets[0]
  const columnDNA = useColumnDNA(activeGridSheet)
  const scratchpad = useScratchpad({ sheetId: activeSheetId, mainSheetData: activeGridSheet })
  const rowSummarizer = useRowSummarizer()
  const activeSheetMatrix = useMemo(
    () => (activeGridSheet ? getSheetMatrix(activeGridSheet) : []),
    [activeGridSheet]
  )

  const nlFilterColumnSchema = useMemo<NLFilterColumnSchema[]>(
    () =>
      Array.from({ length: DEFAULT_COLS }, (_, columnIndex) => {
        const column = colIndexToLetter(columnIndex)
        const headerValue = getCellDisplayValue(activeSheetMatrix[0]?.[columnIndex] ?? null)
        const header =
          headerValue !== null && String(headerValue).trim()
            ? String(headerValue).trim()
            : `Column ${column}`
        const sampleValues = activeSheetMatrix
          .slice(1, 8)
          .map((row) => getCellDisplayValue(row?.[columnIndex] ?? null))
          .filter((value): value is string | number | boolean => value !== null && value !== '')
          .map((value) => String(value))

        return {
          index: columnIndex,
          column,
          header,
          sampleValues,
        }
      }),
    [activeSheetMatrix]
  )

  const nlFilterSampleData = useMemo<NLFilterSampleRow[]>(
    () =>
      activeSheetMatrix
        .slice(1, 11)
        .map((row, index) => ({
          rowIndex: index + 1,
          values: Object.fromEntries(
            nlFilterColumnSchema.map((column) => [
              column.header,
              getCellDisplayValue(row?.[column.index] ?? null),
            ])
          ),
        }))
        .filter((row) =>
          Object.values(row.values).some((value) => value !== null && value !== '')
        ),
    [activeSheetMatrix, nlFilterColumnSchema]
  )

  useEffect(() => {
    const isLocalDebugSession =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (!isLocalDebugSession) return

    const debugWindow = window as Window & {
      __quiksheetsDebug?: {
        getSheetState: typeof useSheetStore.getState
        getWorkbookState: typeof useWorkbookStore.getState
        // feature panel stores — exposed for headless smoke testing
        chartBuilder: { open: () => void; close: () => void }
        pivotBuilder: { open: () => void; close: () => void }
        formBuilder:  { open: () => void; close: () => void }
        cleanData:    { open: () => void; close: () => void }
        forecast:     { open: () => void; close: () => void }
        comments:     { openPanel: () => void; closePanel: () => void; openComposer: (t: { sheetId: string; cellAddress: string }) => void }
        versionHistory: { open: () => void; close: () => void }
        share:        { open: () => void; close: () => void }
        protectedRanges: { open: () => void; close: () => void }
        cf: typeof useCFStore.getState
        cfDebug: {
          evaluateRules: typeof evaluateRules
          applyRulesToSheet: typeof applyRulesToSheet
        }
        cellOps: typeof cellOps
        printSettings: typeof usePrintSettingsStore.getState
      }
    }

    debugWindow.__quiksheetsDebug = {
      getSheetState: useSheetStore.getState,
      getWorkbookState: useWorkbookStore.getState,
      chartBuilder: {
        open:  () => useChartPanelStore.getState().openBuilder(),
        close: () => useChartPanelStore.getState().closeBuilder(),
      },
      pivotBuilder: {
        open:  () => usePivotUiStore.getState().openBuilder(),
        close: () => usePivotUiStore.getState().closeBuilder(),
      },
      formBuilder: {
        open:  () => useFormBuilderStore.getState().open(),
        close: () => useFormBuilderStore.getState().close(),
      },
      cleanData: {
        open:  () => useCleanDataStore.getState().open(),
        close: () => useCleanDataStore.getState().close(),
      },
      forecast: {
        open:  () => useForecastStore.getState().open(),
        close: () => useForecastStore.getState().close(),
      },
      comments: {
        openPanel:    () => useCommentsUiStore.getState().openPanel(),
        closePanel:   () => useCommentsUiStore.getState().closePanel(),
        openComposer: (t) => useCommentsUiStore.getState().openComposer(t),
      },
      versionHistory: {
        open:  () => useVersionUiStore.getState().open(),
        close: () => useVersionUiStore.getState().close(),
      },
      share: {
        open:  () => useShareDialogStore.getState().open(),
        close: () => useShareDialogStore.getState().close(),
      },
      protectedRanges: {
        open:  () => useProtectedRangesUiStore.getState().open(),
        close: () => useProtectedRangesUiStore.getState().close(),
      },
      cf: useCFStore.getState,
      cfDebug: { evaluateRules, applyRulesToSheet },
      cellOps,
      printSettings: usePrintSettingsStore.getState,
    }

    return () => {
      delete debugWindow.__quiksheetsDebug
    }
  }, [])

  const getActiveSheetData = useCallback((): ExportSheet => {
    return {
      name: activeSheet?.name ?? 'Sheet1',
      data: toExportRows(activeGridSheet),
    }
  }, [activeGridSheet, activeSheet])

  const getAllSheetsData = useCallback((): ExportSheet[] => {
    return sheets
      .filter((sheet) => !sheet.isHidden)
      .sort((left, right) => left.order - right.order)
      .map((sheet) => ({
        name: sheet.name,
        data: toExportRows(gridSheets.find((gridSheet) => gridSheet.id === sheet.id)),
      }))
  }, [gridSheets, sheets])

  /**
   * Build the round-trip extras (named ranges, data validation, CF) for
   * the high-fidelity XLSX export. Pulled fresh on each call so the
   * latest store state is included.
   */
  const buildExtrasForExport = useCallback(() => {
    const named = useNamedRangesStore.getState().names[workbookId] ?? []
    const cfRules = useCFStore.getState().rules
    const validation = useSheetStore.getState().validationRules
    return buildExportExtras({
      sheets: gridSheets,
      sheetTabs: sheets,
      namedRanges: named,
      cfRulesByActiveSheet: cfRules,
      validationRules: validation,
    })
  }, [workbookId, sheets, gridSheets])

  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem(`quiksheets_workbook_name:${workbookId}`)
      if (storedName?.trim()) {
        setWorkbookName(storedName)
      }
    } catch {
      // Local storage is optional; the in-memory workbook name remains usable.
    }
  }, [workbookId])

  useEffect(() => {
    try {
      window.localStorage.setItem(`quiksheets_workbook_name:${workbookId}`, workbookName)
    } catch {
      // Local storage is optional; saves still proceed through SaveStatus.
    }
  }, [workbookId, workbookName])

  // Load template data if this workbook was created from a template
  useEffect(() => {
    try {
      const templateKey = `quiksheets_template_data:${workbookId}`
      const raw = window.localStorage.getItem(templateKey)
      if (!raw) return

      const templateSheets = JSON.parse(raw) as Sheet[]
      window.localStorage.removeItem(templateKey)

      const templateTabs: SheetTab[] = templateSheets.map((sheet, index) => ({
        id: typeof sheet.id === 'string' ? sheet.id : `sheet${index + 1}`,
        name: sheet.name,
        color: null,
        isHidden: false,
        order: index,
      }))
      const firstId = templateTabs[0]?.id ?? 'sheet1'

      const { replaceSheets } = useWorkbookStore.getState()
      replaceSheets(templateTabs, firstId)
      replaceGridSheets(templateSheets)
    } catch {
      // Template data missing or corrupt; start with default sheet
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply saved conditional formatting rules once after the workbook loads
  useEffect(() => {
    const timer = window.setTimeout(() => {
      applyAllCFRules(workbookId)
    }, 500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Merge pending form submissions into the workbook on mount
  useEffect(() => {
    void (async () => {
      const { listFormsForWorkbook, takeSubmissions } = await import(
        '@/features/forms/storage/localFormStore'
      )
      const { cloneSheetWithData, getSheetMatrix } = await import('@/lib/fortuneSheet')
      const forms = listFormsForWorkbook(workbookId)
      if (forms.length === 0) return

      const state = useSheetStore.getState()
      let nextSheets = state.gridSheets
      let didChange = false

      for (const form of forms) {
        const subs = takeSubmissions(form.id)
        if (subs.length === 0) continue
        const sheetIdx = nextSheets.findIndex((s) => s.id === form.sheetId)
        if (sheetIdx < 0) continue
        const sheet = nextSheets[sheetIdx]
        if (!sheet) continue
        const matrix = getSheetMatrix(sheet)
        const next = matrix.map((row) => [...(row ?? [])])
        // start writing at the first empty row at the bottom
        let writeRow = next.length
        for (const sub of subs) {
          let row = next[writeRow]
          if (!row) {
            row = []
            next[writeRow] = row
          }
          for (const field of form.fields) {
            const raw = sub.values[field.id]
            const display = raw === undefined || raw === null ? '' : String(raw)
            row[field.columnIndex] = { v: display, m: display }
          }
          writeRow++
        }
        nextSheets = nextSheets.map((s, i) =>
          i === sheetIdx ? cloneSheetWithData(s, next) : s
        )
        didChange = true
      }

      if (didChange) {
        useSheetStore.getState().replaceGridSheets(nextSheets)
        toast.success('Form submissions added to the sheet.')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleQuickSort = useCallback(
    (direction: SortDirection) => {
      if (selectedCell) {
        // Excel's Sort A→Z / Sort Z→A default to "my data has a header",
        // i.e. row 0 is pinned in place. Set hasHeader: true explicitly so
        // we don't sort the header into the middle of the data.
        applySort({ columnIndex: selectedCell.col, direction, hasHeader: true })
        return
      }

      setShowSort(true)
    },
    [applySort, selectedCell]
  )

  const handleAiFormulaCommand = useCallback(() => {
    setFormulaBarValue('=?')
    if (selectedCell) {
      setEditingCell(selectedCell)
    }
  }, [selectedCell, setEditingCell, setFormulaBarValue])

  const commandItems = useMemo<CommandPaletteItem[]>(() => {
    const sheetCommands: CommandPaletteItem[] = sheets
      .filter((sheet) => !sheet.isHidden)
      .sort((left, right) => left.order - right.order)
      .map((sheet) => ({
        id: `switch-sheet-${sheet.id}`,
        label: `Switch to Sheet ${sheet.name}`,
        category: 'Navigation',
        keywords: ['sheet', sheet.name],
        onExecute: () => setActiveWorkbookSheet(sheet.id),
      }))

    return [
      {
        id: 'go-dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        keywords: ['home'],
        onExecute: () => router.push('/dashboard'),
      },
      {
        id: 'new-sheet',
        label: 'New Sheet',
        category: 'Navigation',
        keywords: ['add sheet'],
        onExecute: () => addSheet(),
      },
      ...sheetCommands,
      { id: 'sort-az', label: 'Sort A-Z', category: 'Actions', onExecute: () => handleQuickSort('asc') },
      { id: 'sort-za', label: 'Sort Z-A', category: 'Actions', onExecute: () => handleQuickSort('desc') },
      { id: 'add-filter', label: 'Add Filter', category: 'Actions', onExecute: () => setShowFilter(true) },
      { id: 'clear-filters', label: 'Clear Filters', category: 'Actions', onExecute: clearFilters },
      { id: 'find', label: 'Find', category: 'Actions', onExecute: () => setShowFindReplace(true) },
      {
        id: 'find-replace',
        label: 'Find & Replace',
        category: 'Actions',
        onExecute: () => setShowFindReplace(true),
      },
      { id: 'import-file', label: 'Import File', category: 'Actions', onExecute: () => setShowImport(true) },
      {
        id: 'export-excel',
        label: 'Export Excel',
        category: 'Actions',
        onExecute: () => exportToExcelFidelity(gridSheets, workbookName, buildExtrasForExport()),
      },
      {
        id: 'export-csv',
        label: 'Export CSV',
        category: 'Actions',
        onExecute: () => exportToCSV(getActiveSheetData(), workbookName),
      },
      {
        id: 'export-pdf',
        label: 'Export PDF',
        category: 'Actions',
        onExecute: () => exportToPDF(getActiveSheetData(), workbookName),
      },
      {
        id: 'data-validation',
        label: 'Data Validation',
        category: 'Actions',
        onExecute: () => setShowValidation(true),
      },
      {
        id: 'ai-formula',
        label: 'AI Formula Assistant',
        category: 'AI',
        keywords: ['formula', 'assistant'],
        onExecute: handleAiFormulaCommand,
      },
      {
        id: 'formula-explainer',
        label: 'Formula Explainer',
        category: 'AI',
        keywords: ['explain', 'formula'],
        onExecute: () => window.alert('Hover over any formula cell to open the Formula Explainer.'),
      },
      { id: 'map-view', label: 'Map View', category: 'View', onExecute: toggleMap },
      {
        id: 'dark-mode',
        label: 'Dark Mode',
        category: 'View',
        onExecute: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'keyboard-shortcuts',
        label: 'Keyboard Shortcuts',
        category: 'View',
        onExecute: () => setShowShortcuts(true),
      },
    ]
  }, [
    addSheet,
    buildExtrasForExport,
    clearFilters,
    getActiveSheetData,
    gridSheets,
    handleAiFormulaCommand,
    handleQuickSort,
    resolvedTheme,
    router,
    setActiveWorkbookSheet,
    setShowFindReplace,
    setTheme,
    sheets,
    toggleMap,
    workbookName,
  ])

  const handleDependencyCellSelect = useCallback(
    (target: DependencyMapCellTarget) => {
      const nextSelectedCell = {
        row: target.row,
        col: target.col,
        sheet: target.sheetIndex,
      }

      setShowMap(false)
      setActiveWorkbookSheet(target.sheetId)
      setSelectedCell(nextSelectedCell)
      setSelectedRange({
        start: nextSelectedCell,
        end: nextSelectedCell,
      })

      const targetSheet = gridSheets[target.sheetIndex]
      const targetCell = targetSheet ? getCellFromSheet(targetSheet, target.row, target.col) : null
      setFormulaBarValue(getCellFormulaBarValue(targetCell))

      window.setTimeout(() => {
        try {
          gridInstance?.activateSheet({ id: target.sheetId })
          gridInstance?.setSelection(
            [{ row: [target.row, target.row], column: [target.col, target.col] }],
            { id: target.sheetId }
          )
        } catch {
          // If the workbook is still syncing sheets, the store selection above keeps the app coherent.
        }
      }, 0)
    },
    [
      gridInstance,
      gridSheets,
      setActiveWorkbookSheet,
      setFormulaBarValue,
      setSelectedCell,
      setSelectedRange,
      setShowMap,
    ]
  )

  const handleImport = useCallback(
    (importedSheets: ImportedSheet[]) => {
      if (importedSheets.length === 0) return

      const createImportedSheetId = (): string =>
        `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

      const reserveUniqueName = (proposedName: string, usedNames: Set<string>): string => {
        const trimmed = proposedName.trim()
        const baseName = trimmed || 'Sheet'
        let candidate = baseName
        let suffix = 2

        while (usedNames.has(candidate.toLowerCase())) {
          candidate = `${baseName} (${suffix})`
          suffix += 1
        }

        usedNames.add(candidate.toLowerCase())
        return candidate
      }

      const sheetState = useSheetStore.getState()
      const workbookState = useWorkbookStore.getState()
      const existingSheets = new Map(
        sheetState.gridSheets
          .filter((sheet) => typeof sheet.id === 'string')
          .map((sheet) => [sheet.id as string, sheet])
      )
      const importedGridSheets = new Map<string, Sheet>()

      const orderedWorkbookSheets = [...workbookState.sheets].sort((left, right) => left.order - right.order)
      const shouldReplaceFirstSheet =
        orderedWorkbookSheets.length === 1 &&
        sheetState.gridSheets.length === 1 &&
        isSheetEmpty(sheetState.gridSheets[0]!)

      const nextWorkbookSheets: SheetTab[] = shouldReplaceFirstSheet
        ? []
        : orderedWorkbookSheets.map((sheet) => ({ ...sheet }))
      const usedNames = new Set(nextWorkbookSheets.map((sheet) => sheet.name.toLowerCase()))
      let activeImportedSheetId: string | null = null

      let importIndex = 0
      if (shouldReplaceFirstSheet) {
        const firstTab = orderedWorkbookSheets[0]
        if (firstTab) {
          const firstImportedSheet = importedSheets[0]
          if (firstImportedSheet) {
            const sheetName = reserveUniqueName(firstImportedSheet.name, usedNames)
            nextWorkbookSheets.push({
              ...firstTab,
              name: sheetName,
              order: 0,
            })
            importedGridSheets.set(
              firstTab.id,
              firstImportedSheet.fidelity
                ? createSheetFromImportedDataWithFidelity(
                    sheetName,
                    firstTab.id,
                    firstImportedSheet.data,
                    firstImportedSheet.fidelity,
                    0,
                    true,
                  )
                : createSheetFromImportedData(sheetName, firstTab.id, firstImportedSheet.data, 0, true)
            )
            activeImportedSheetId = firstTab.id
            importIndex = 1
          }
        }
      }

      for (let index = importIndex; index < importedSheets.length; index += 1) {
        const importedSheet = importedSheets[index]
        if (!importedSheet) continue

        const newSheetId = createImportedSheetId()
        const newSheetName = reserveUniqueName(importedSheet.name, usedNames)
        const newTab: SheetTab = {
          id: newSheetId,
          name: newSheetName,
          color: null,
          isHidden: false,
          order: nextWorkbookSheets.length,
        }
        nextWorkbookSheets.push(newTab)

        importedGridSheets.set(
          newTab.id,
          importedSheet.fidelity
            ? createSheetFromImportedDataWithFidelity(
                newTab.name,
                newTab.id,
                importedSheet.data,
                importedSheet.fidelity,
                newTab.order,
                false,
              )
            : createSheetFromImportedData(newTab.name, newTab.id, importedSheet.data, newTab.order, false)
        )

        if (!activeImportedSheetId) {
          activeImportedSheetId = newTab.id
        }
      }

      const finalWorkbookSheets = nextWorkbookSheets.map((sheet, index) => ({
        ...sheet,
        order: index,
      }))
      const nextActiveSheetId = activeImportedSheetId ?? workbookState.activeSheetId

      const finalGridSheets = [...finalWorkbookSheets]
        .sort((left, right) => left.order - right.order)
        .map((tabSheet) => {
          const importedGridSheet = importedGridSheets.get(tabSheet.id)
          const existingGridSheet = existingSheets.get(tabSheet.id)
          const base = importedGridSheet ?? existingGridSheet ?? createDefaultSheet(tabSheet.name, tabSheet.id)

          return {
            ...base,
            id: tabSheet.id,
            name: tabSheet.name,
            order: tabSheet.order,
            hide: tabSheet.isHidden ? 1 : 0,
            status: tabSheet.id === nextActiveSheetId ? (1 as const) : (0 as const),
            ...(tabSheet.color ? { color: tabSheet.color } : {}),
          }
        })

      setSkipNextTabSync(true)
      replaceSheets(finalWorkbookSheets, nextActiveSheetId)
      replaceGridSheets(finalGridSheets)
    },
    [replaceGridSheets, replaceSheets, setSkipNextTabSync]
  )

  // ── AutoSum ──────────────────────────────────────────────────────────────
  const handleAutoSum = useCallback(() => {
    if (!selectedCell) {
      toast.message('Select a cell first, then click AutoSum')
      return
    }
    const { row, col } = selectedCell
    const colLetter = colIndexToLetter(col)
    // Walk upward from the selected cell to find a contiguous numeric range
    let topRow = row - 1
    while (topRow >= 0) {
      const cellVal = getCellDisplayValue(activeSheetMatrix[topRow]?.[col] ?? null)
      if (cellVal === null || cellVal === '') break
      if (typeof cellVal === 'string' && isNaN(Number(cellVal))) break
      topRow--
    }
    topRow++ // advance back to last valid row
    const formula =
      topRow < row
        ? `=SUM(${colLetter}${topRow + 1}:${colLetter}${row})`
        : `=SUM(${colLetter}1:${colLetter}${Math.max(1, row)})`
    setFormulaBarValue(formula)
    setEditingCell(selectedCell)
  }, [selectedCell, activeSheetMatrix, setFormulaBarValue, setEditingCell])

  // ── Excel-faithful keyboard shortcuts (F2, Ctrl+;, Ctrl+:, Ctrl+Shift+L, Alt+=, Ctrl+P) ──
  useExcelKeyboardShortcuts({
    onToggleFilter: () => setShowFilter(true),
    onAutoSum: handleAutoSum,
    onPrint: () => exportToPDF(getActiveSheetData(), workbookName),
  })

  // ── Insert / Delete Row ──────────────────────────────────────────────────
  const handleInsertRow = useCallback(() => {
    if (!selectedCell) {
      toast.message('Select a cell to insert a row below it')
      return
    }
    if (gridInstance) {
      // Use FortuneSheet API for proper undo support
      gridInstance.insertRowOrColumn('row', selectedCell.row, 1, 'rightbottom')
      toast.success(`Row ${selectedCell.row + 2} inserted`)
    } else {
      const insertAfter = selectedCell.row
      const updatedSheets = gridSheets.map((s) => {
        if (s.id !== activeSheetId) return s
        const newCelldata = (s.celldata ?? []).map((cell) =>
          cell.r > insertAfter ? { ...cell, r: cell.r + 1 } : cell
        )
        return { ...s, celldata: newCelldata }
      })
      replaceGridSheets(updatedSheets)
      toast.success(`Row ${insertAfter + 2} inserted`)
    }
  }, [selectedCell, gridInstance, gridSheets, activeSheetId, replaceGridSheets])

  const handleDeleteRow = useCallback(() => {
    if (!selectedCell) {
      toast.message('Select a cell to delete its row')
      return
    }
    if (gridInstance) {
      // Use FortuneSheet API for proper undo support
      gridInstance.deleteRowOrColumn('row', selectedCell.row, selectedCell.row)
      toast.success(`Row ${selectedCell.row + 1} deleted`)
    } else {
      const deleteAt = selectedCell.row
      const updatedSheets = gridSheets.map((s) => {
        if (s.id !== activeSheetId) return s
        const newCelldata = (s.celldata ?? [])
          .filter((cell) => cell.r !== deleteAt)
          .map((cell) => (cell.r > deleteAt ? { ...cell, r: cell.r - 1 } : cell))
        return { ...s, celldata: newCelldata }
      })
      replaceGridSheets(updatedSheets)
      toast.success(`Row ${deleteAt + 1} deleted`)
    }
  }, [selectedCell, gridInstance, gridSheets, activeSheetId, replaceGridSheets])

  // ── Merge / Unmerge cells ────────────────────────────────────────────────
  type MergeCapable = {
    mergeCells?: (ranges: unknown[], type: string, opts?: { id?: string }) => void
    cancelMerge?: (ranges: unknown[], opts?: { id?: string }) => void
  }

  const handleMergeCells = useCallback(() => {
    if (!selectedRange || !gridInstance) {
      toast.message('Select a range of cells to merge')
      return
    }
    const startRow = Math.min(selectedRange.start.row, selectedRange.end.row)
    const endRow = Math.max(selectedRange.start.row, selectedRange.end.row)
    const startCol = Math.min(selectedRange.start.col, selectedRange.end.col)
    const endCol = Math.max(selectedRange.start.col, selectedRange.end.col)
    if (startRow === endRow && startCol === endCol) {
      toast.message('Select multiple cells to merge')
      return
    }
    ;(gridInstance as unknown as MergeCapable).mergeCells?.(
      [{ row: [startRow, endRow], column: [startCol, endCol] }],
      'merge-all',
      { id: activeSheetId }
    )
  }, [selectedRange, gridInstance, activeSheetId])

  const handleUnmergeCells = useCallback(() => {
    if (!selectedRange || !gridInstance) return
    ;(gridInstance as unknown as MergeCapable).cancelMerge?.(
      [
        {
          row: [selectedRange.start.row, selectedRange.end.row],
          column: [selectedRange.start.col, selectedRange.end.col],
        },
      ],
      { id: activeSheetId }
    )
  }, [selectedRange, gridInstance, activeSheetId])

  // ── Clear formatting ─────────────────────────────────────────────────────
  const handleClearFormatting = useCallback(() => {
    clearFormatOnSelection()
    toast.success('Formatting cleared')
  }, [clearFormatOnSelection])

  // ── Deduplicate rows ─────────────────────────────────────────────────────
  const handleDedupe = useCallback(() => {
    const activeSheet = gridSheets.find((s) => s.id === activeSheetId) ?? gridSheets[0]
    if (!activeSheet) return
    const matrix = getSheetMatrix(activeSheet)
    const seenKeys = new Set<string>()
    const keepRows = new Set<number>()
    keepRows.add(0) // always keep header row
    let duplicateCount = 0

    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r] ?? []
      const isEmpty = row.every((cell) => {
        const v = getCellDisplayValue(cell)
        return v === null || v === ''
      })
      if (isEmpty) {
        keepRows.add(r)
        continue
      }
      const key = row.map((cell) => String(getCellDisplayValue(cell) ?? '')).join('\x00')
      if (seenKeys.has(key)) {
        duplicateCount++
      } else {
        seenKeys.add(key)
        keepRows.add(r)
      }
    }

    if (duplicateCount === 0) {
      toast.success('No duplicate rows found')
      return
    }

    const sortedKeepRows = [...keepRows].sort((a, b) => a - b)
    const rowMap = new Map(sortedKeepRows.map((oldR, newR) => [oldR, newR]))
    const newCelldata = (activeSheet.celldata ?? [])
      .filter((cell) => keepRows.has(cell.r))
      .map((cell) => ({ ...cell, r: rowMap.get(cell.r) ?? cell.r }))

    // FortuneSheet renders from the 2-D `data` matrix, not from `celldata`.
    // If we only rebuild `celldata`, the duplicate rows stay visible on
    // screen even though the toast claims success — same shape as the
    // chart-rendering bug from earlier in this session. Rebuild `data`
    // by compacting rows from the same matrix the dedupe scan ran on.
    const existingData = activeSheet.data
    let newData: typeof existingData | undefined
    if (Array.isArray(existingData) && existingData.length > 0) {
      const cols = existingData[0]?.length ?? 26
      const newRows = sortedKeepRows.map(
        (oldR) => existingData[oldR] ?? (Array(cols).fill(null) as typeof existingData[number]),
      )
      // Pad back up to the original height with empty rows so the
      // grid's overall row count doesn't shrink (and trailing rows
      // don't suddenly show as missing).
      while (newRows.length < existingData.length) {
        newRows.push(Array(cols).fill(null) as typeof existingData[number])
      }
      newData = newRows
    }

    const updatedSheets = gridSheets.map((s) =>
      s.id === activeSheet.id
        ? { ...s, celldata: newCelldata, ...(newData ? { data: newData } : {}) }
        : s,
    )
    replaceGridSheets(updatedSheets)
    toast.success(`Removed ${duplicateCount} duplicate row${duplicateCount === 1 ? '' : 's'}`)
  }, [gridSheets, activeSheetId, replaceGridSheets])

  // ── Row Summarizer shortcut ──────────────────────────────────────────────
  const handleRowSummarizer = useCallback(() => {
    if (!selectedRange) {
      toast.message('Select one or more rows, then click AI Summarise')
      return
    }
    const sheetIdx = gridSheets.findIndex((s) => s.id === activeSheetId)
    rowSummarizer.open({
      sheetIndex: Math.max(0, sheetIdx),
      startRow: Math.min(selectedRange.start.row, selectedRange.end.row),
      endRow: Math.max(selectedRange.start.row, selectedRange.end.row),
    })
  }, [selectedRange, gridSheets, activeSheetId, rowSummarizer])

  // ── Column DNA shortcut ──────────────────────────────────────────────────
  const handleColumnDNA = useCallback(() => {
    if (!selectedCell) {
      toast.message('Select a cell in the column you want to analyse')
      return
    }
    columnDNA.openPanel(selectedCell.col)
  }, [selectedCell, columnDNA])

  // ── View toggles ─────────────────────────────────────────────────────────
  const handleToggleFormulaBar = useCallback(() => {
    setShowFormulaBarUI((v) => !v)
  }, [])

  const handleToggleGridlines = useCallback(() => {
    setShowGridlines((v) => {
      const next = !v
      const updatedSheets = gridSheets.map((s) =>
        s.id === activeSheetId ? { ...s, showGridLines: next ? 1 : 0 } : s
      )
      replaceGridSheets(updatedSheets)
      return next
    })
  }, [gridSheets, activeSheetId, replaceGridSheets])

  // ── Zoom controls ────────────────────────────────────────────────────────
  const applyZoom = useCallback(
    (nextZoom: number) => {
      setZoomLevel(nextZoom)
      const updatedSheets = gridSheets.map((s) =>
        s.id === activeSheetId ? { ...s, zoomRatio: nextZoom } : s
      )
      replaceGridSheets(updatedSheets)
    },
    [gridSheets, activeSheetId, replaceGridSheets]
  )

  const handleZoomIn = useCallback(() => {
    applyZoom(Math.min(parseFloat((zoomLevel + 0.1).toFixed(1)), 2.0))
  }, [zoomLevel, applyZoom])

  const handleZoomOut = useCallback(() => {
    applyZoom(Math.max(parseFloat((zoomLevel - 0.1).toFixed(1)), 0.5))
  }, [zoomLevel, applyZoom])

  const handleZoomReset = useCallback(() => {
    applyZoom(1.0)
  }, [applyZoom])

  const handleNewWorkbookFromMenu = useCallback(() => {
    void (async () => {
      const supabase = getBrowserSupabase()
      if (!supabase) {
        const id = `wb_${Date.now()}`
        try {
          localStorage.setItem(`quiksheets_workbook_name:${id}`, 'Untitled Workbook')
        } catch {
          /* ignore */
        }
        router.push(`/sheet/${id}`)
        return
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/dashboard')
        return
      }
      const { data: ws } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const workspaceId = ws?.workspace_id as string | undefined
      if (!workspaceId) {
        router.push('/dashboard')
        return
      }
      const result = await createWorkbookAction({ name: 'Untitled Workbook', workspaceId })
      if (result.ok && result.id) {
        router.push(`/sheet/${result.id}`)
      } else {
        toast.error(result.error ?? 'Could not create workbook')
      }
    })()
  }, [router])

  // ── New feature stubs (Charts, Forms, Clean Data, Pivot, Forecasting,
  //    Comments, Version History, Share Link, Protected Ranges) ─────────
  const openCleanData = useCleanDataStore((s) => s.open)
  const openChartBuilder = useChartPanelStore((s) => s.openBuilder)
  const openFormBuilder = useFormBuilderStore((s) => s.open)
  const openPivotBuilder = usePivotUiStore((s) => s.openBuilder)
  const openForecast = useForecastStore((s) => s.open)
  const openCommentsPanel = useCommentsUiStore((s) => s.openPanel)
  const openVersionHistory = useVersionUiStore((s) => s.open)
  const openShareDialog = useShareDialogStore((s) => s.open)
  const openProtectedRanges = useProtectedRangesUiStore((s) => s.open)

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <WorkbookSidebar
        activeWorkbookId={workbookId}
        collapsed={sidebarCollapsed}
        onNewWorkbook={handleNewWorkbookFromMenu}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Workbook header — slim title bar above the menu bar */}
        <header className="flex h-10 w-full shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>

            {isEditingName ? (
              <input
                type="text"
                value={workbookName}
                onChange={(e) => setWorkbookName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false)
                }}
                autoFocus
                className="w-[260px] rounded border border-blue-400 bg-blue-50 px-2 py-0.5 text-sm text-zinc-800 outline-none dark:bg-blue-500/15 dark:text-blue-100"
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                title="Click to rename"
                className="max-w-[180px] truncate rounded px-1.5 py-0.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:max-w-[260px] md:max-w-[360px]"
              >
                {workbookName}
              </button>
            )}

            <SaveStatus workbookName={workbookName} workbookData={gridSheets} />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => setShowImport(true)}
              title="Import"
              aria-label="Import"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:px-2.5"
            >
              <Upload className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <ExportMenu
              workbookName={workbookName}
              getActiveSheetData={getActiveSheetData}
              getAllSheetsData={getAllSheetsData}
            />

            <div className="mx-1 hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" />

            <button
              onClick={toggleMap}
              title="Dependency map (Ctrl+M)"
              aria-label="Dependency Map"
              className={[
                'flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors sm:px-2.5',
                showMap
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              <Network className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Map</span>
            </button>

            <PresenceAvatars />
            <ThemeToggle />
          </div>
        </header>

        <Ribbon
          handlers={{
            workbookId,
            // File
            onNewWorkbook: handleNewWorkbookFromMenu,
            onOpenDashboard: () => router.push('/dashboard'),
            onSaveNow: () => toast.success('Saved'),
            onImport: () => setShowImport(true),
            onExportCSV: () => exportToCSV(getActiveSheetData(), workbookName),
            onExportXLSX: () => exportToExcelFidelity(gridSheets, workbookName, buildExtrasForExport()),
            onExportPDF: () => exportToPDF(getActiveSheetData(), workbookName),
            onPrint: () => exportToPDF(getActiveSheetData(), workbookName),
            // Home
            onSortAsc: () => handleQuickSort('asc'),
            onSortDesc: () => handleQuickSort('desc'),
            onCustomSort: () => setShowSort(true),
            onFilter: () => setShowFilter(true),
            onFind: () => setShowFindReplace(true),
            onConditionalFormatting: () => setShowCF(true),
            onMergeCells: handleMergeCells,
            onUnmergeCells: handleUnmergeCells,
            onClearFormatting: handleClearFormatting,
            onValidation: () => setShowValidation(true),
            onAutoSum: handleAutoSum,
            onInsertRow: handleInsertRow,
            onDeleteRow: handleDeleteRow,
            // Insert
            onInsertSheet: () => addSheet(),
            onAIAssistant: handleAiFormulaCommand,
            onRowSummarizer: handleRowSummarizer,
            onColumnDNA: handleColumnDNA,
            onInsertChart: openChartBuilder,
            onInsertForm: openFormBuilder,
            onInsertPivot: openPivotBuilder,
            onCleanData: openCleanData,
            onForecast: openForecast,
            // Formulas / Data
            onMapView: toggleMap,
            onDedupe: handleDedupe,
            // Review / Collab
            onComments: openCommentsPanel,
            onShareLink: openShareDialog,
            onProtectedRanges: openProtectedRanges,
            onVersionHistory: openVersionHistory,
            // Review / View
            onShortcuts: () => setShowShortcuts(true),
            formulaBarVisible: showFormulaBarUI,
            gridlinesVisible: showGridlines,
            onToggleFormulaBar: handleToggleFormulaBar,
            onToggleGridlines: handleToggleGridlines,
            onZoomIn: handleZoomIn,
            onZoomOut: handleZoomOut,
            onZoomReset: handleZoomReset,
          }}
        />

      {showFormulaBarUI && <FormulaBar />}

      {nlFilterVisible && <NLFilterBar columnSchema={nlFilterColumnSchema} sampleData={nlFilterSampleData} />}

      <div className="relative flex-1 overflow-hidden">
        <SpreadsheetGrid
          workbookId={workbookId}
          onOpenColumnDNA={columnDNA.openPanel}
          onSummarizeRows={rowSummarizer.open}
          onViewCellHistory={cellHistory.openHistory}
          onAddComment={(target) => useCommentsUiStore.getState().openComposer(target)}
          onCellChangeBroadcast={collab.broadcastEdit}
        />
        {/* Excel-style embedded objects — sit above the grid canvas, bounded
            to the sheet view area (not the whole viewport).
            Each wrapped in a silent ErrorBoundary so a crash in one overlay
            (e.g. chart render, pivot aggregation) doesn't freeze the grid. */}
        <ErrorBoundary silent><ChartsLayer /></ErrorBoundary>
        <ErrorBoundary silent><ImagesLayer /></ErrorBoundary>
        <ErrorBoundary silent><PivotsLayer /></ErrorBoundary>
        <ErrorBoundary silent><SlicersLayer /></ErrorBoundary>
        <ErrorBoundary silent><FillHandle /></ErrorBoundary>
        <ErrorBoundary silent><RemoteCursors /></ErrorBoundary>
        {showMap && (
          <ErrorBoundary fallback={<div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 text-sm text-red-600 dark:bg-zinc-900/80">Dependency map failed to render.</div>}>
            <DependencyMap
              sheetData={gridSheets}
              onCellSelect={handleDependencyCellSelect}
              onExit={() => setShowMap(false)}
            />
          </ErrorBoundary>
        )}
      </div>

      <StatusBar />
      <SheetTabsBar />

      <SortPanel isOpen={showSort} onClose={() => setShowSort(false)} totalColumns={DEFAULT_COLS} />
      <FilterPanel isOpen={showFilter} onClose={() => setShowFilter(false)} totalColumns={DEFAULT_COLS} />
      <FindReplace />
      <DataValidation isOpen={showValidation} onClose={() => setShowValidation(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} onImport={handleImport} />
      {cellHistory.showHistory && (
        <CellHistoryPanel
          cellAddress={cellHistory.cellAddress}
          entries={cellHistory.history}
          isLoading={cellHistory.isLoading}
          isOpen={cellHistory.showHistory}
          isRestoring={cellHistory.isRestoring}
          onClose={cellHistory.closeHistory}
          onRestore={cellHistory.handleRestore}
        />
      )}
      {columnDNA.showPanel && (
        <ColumnDNAPanel
          analysis={columnDNA.analysis}
          columnLabel={columnDNA.columnLabel}
          isLoading={columnDNA.isLoading}
          isOpen={columnDNA.showPanel}
          onClose={columnDNA.closePanel}
        />
      )}
      <RowSummarizer
        error={rowSummarizer.error}
        insights={rowSummarizer.insights}
        isLoading={rowSummarizer.isLoading}
        isOpen={rowSummarizer.isOpen}
        rowCount={rowSummarizer.rowCount}
        stats={rowSummarizer.stats}
        summary={rowSummarizer.summary}
        onClose={rowSummarizer.close}
        onCopy={rowSummarizer.copySummary}
        onExport={rowSummarizer.exportReport}
        onInsertBelow={rowSummarizer.insertBelowSelection}
      />
      <ScratchpadToggle isOpen={scratchpad.isOpen} onToggle={scratchpad.toggleScratchpad} />
      {scratchpad.isOpen && (
        <ScratchpadPanel
          data={scratchpad.scratchpadData}
          isOpen={scratchpad.isOpen}
          mainSheetData={scratchpad.mainSheetData}
          onChange={scratchpad.setScratchpadData}
          onClear={scratchpad.clearScratchpadData}
          onClose={scratchpad.closeScratchpad}
        />
      )}
      <CommandPalette
        isOpen={showCommandPalette}
        items={commandItems}
        onOpenChange={setShowCommandPalette}
      />
      <KeyboardShortcuts isOpen={showShortcuts} onOpenChange={setShowShortcuts} />
      <ConditionalFormatting isOpen={showCF} onClose={() => setShowCF(false)} />
      <InsertFunctionDialog
        open={insertFunctionOpen}
        onOpenChange={(open) => useInsertFunctionStore.getState().setOpen(open)}
      />
      <NameManagerDialog
        open={nameManagerOpen}
        onOpenChange={(open) => useNamedRangesStore.getState().setDialogOpen(open)}
        workbookId={workbookId}
      />
      <ErrorBoundary><CleanDataPanel /></ErrorBoundary>
      <ErrorBoundary><ChartBuilder /></ErrorBoundary>
      <ErrorBoundary><SymbolPicker /></ErrorBoundary>
      <ErrorBoundary>
        <TextToColumnsDialog
          open={textToColsOpen}
          onOpenChange={(open) => useTextToColsStore.getState().setOpen(open)}
        />
      </ErrorBoundary>
      <ErrorBoundary><FormBuilder workbookId={workbookId} /></ErrorBoundary>
      <ErrorBoundary><PivotBuilder /></ErrorBoundary>
      <ErrorBoundary><ForecastPanel /></ErrorBoundary>
      <ErrorBoundary><CommentsPanel workbookId={workbookId} /></ErrorBoundary>
      <ErrorBoundary><CommentComposer workbookId={workbookId} /></ErrorBoundary>
      <ErrorBoundary><VersionHistoryPanel workbookId={workbookId} /></ErrorBoundary>
      <ErrorBoundary><ShareDialog workbookId={workbookId} workbookName={workbookName} /></ErrorBoundary>
      <ErrorBoundary><ProtectedRangesDialog workbookId={workbookId} /></ErrorBoundary>
      </div>
    </main>
  )
}
