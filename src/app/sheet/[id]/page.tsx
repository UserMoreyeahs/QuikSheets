'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Network, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { CommandPalette, type CommandPaletteItem } from '@/components/CommandPalette'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MenuBar } from '@/features/menu-bar/components/MenuBar'
import { WorkbookSidebar } from '@/features/workbook/components/WorkbookSidebar'
import { createWorkbookAction } from '@/features/workbook/actions'
import { getBrowserSupabase } from '@/lib/supabase/client'
import {
  createSheetFromImportedData,
  getCellFormulaBarValue,
  getCellFromSheet,
  getCellDisplayValue,
  getSheetMatrix,
  isSheetEmpty,
} from '@/lib/fortuneSheet'
import { createDefaultSheet } from '@/lib/defaultSheet'
import { SpreadsheetGrid } from '@/features/grid'
import { FormulaBar } from '@/features/formula-bar'
import { FormattingToolbar, useFormattingShortcuts } from '@/features/toolbar'
import { SheetTabsBar } from '@/features/sheets'
import { SortPanel } from '@/features/grid/components/SortPanel'
import { FilterPanel } from '@/features/grid/components/FilterPanel'
import { FindReplace } from '@/features/grid/components/FindReplace'
import { DataValidation } from '@/features/grid/components/DataValidation'
import { ImportModal } from '@/features/grid/components/ImportModal'
import { ExportMenu } from '@/features/grid/components/ExportMenu'
import { SaveStatus } from '@/features/grid/components/SaveStatus'
import { exportToCSV, exportToExcel, exportToPDF } from '@/features/grid/utils/exportUtils'
import { DependencyMap, useDependencyMap, type DependencyMapCellTarget } from '@/features/dependency-map'
import { CellHistoryPanel, useCellHistory } from '@/features/cell-history'
import { NLFilterBar, type NLFilterColumnSchema, type NLFilterSampleRow } from '@/features/nl-filter'
import { ColumnDNAPanel, useColumnDNA } from '@/features/column-dna'
import { ScratchpadPanel, ScratchpadToggle, useScratchpad } from '@/features/scratchpad'
import { RowSummarizer, useRowSummarizer } from '@/features/row-summarizer'
import { ConditionalFormatting, applyAllCFRules } from '@/features/conditional-formatting'
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
    applySort,
    clearFilters,
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

  const [showSort, setShowSort] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCF, setShowCF] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
      }
    }

    debugWindow.__quiksheetsDebug = {
      getSheetState: useSheetStore.getState,
      getWorkbookState: useWorkbookStore.getState,
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

  const handleQuickSort = useCallback(
    (direction: SortDirection) => {
      if (selectedCell) {
        applySort({ columnIndex: selectedCell.col, direction })
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
        onExecute: () => exportToExcel(getAllSheetsData(), workbookName),
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
    clearFilters,
    getActiveSheetData,
    getAllSheetsData,
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
              createSheetFromImportedData(sheetName, firstTab.id, firstImportedSheet.data, 0, true)
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
          createSheetFromImportedData(newTab.name, newTab.id, importedSheet.data, newTab.order, false)
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

  const menuHandlers = useMemo(
    () => ({
      onNewWorkbook: handleNewWorkbookFromMenu,
      onOpenDashboard: () => router.push('/dashboard'),
      onSaveNow: () => {
        toast.success('Saved')
      },
      onImport: () => setShowImport(true),
      onExportCSV: () => exportToCSV(getActiveSheetData(), workbookName),
      onExportXLSX: () => exportToExcel(getAllSheetsData(), workbookName),
      onExportPDF: () => exportToPDF(getActiveSheetData(), workbookName),
      onFind: () => setShowFindReplace(true),
      onFindReplace: () => setShowFindReplace(true),
      onMapView: toggleMap,
      onInsertSheet: () => addSheet(),
      onClearFormatting: () => toast.message('Coming soon', { description: 'Tracked in rebuild plan.' }),
      onConditionalFormatting: () => setShowCF(true),
      onMergeCells: () => toast.message('Use Ctrl+Shift+M on a selected range'),
      onUnmergeCells: () => toast.message('Use Ctrl+Shift+U on a merged cell'),
      onSort: () => setShowSort(true),
      onFilter: () => setShowFilter(true),
      onValidation: () => setShowValidation(true),
      onAIAssistant: handleAiFormulaCommand,
      onScratchpad: () => toast.message('Click the scratchpad button (bottom-right) or press Ctrl+`'),
      onShortcuts: () => setShowShortcuts(true),
      onCommandPalette: () => setShowCommandPalette(true),
    }),
    [
      addSheet,
      getActiveSheetData,
      getAllSheetsData,
      handleAiFormulaCommand,
      handleNewWorkbookFromMenu,
      router,
      setShowFindReplace,
      toggleMap,
      workbookName,
    ]
  )

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
                className="max-w-[360px] truncate rounded px-1.5 py-0.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {workbookName}
              </button>
            )}

            <SaveStatus workbookName={workbookName} workbookData={gridSheets} />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Upload className="h-3 w-3" aria-hidden="true" />
              Import
            </button>

            <ExportMenu
              workbookName={workbookName}
              getActiveSheetData={getActiveSheetData}
              getAllSheetsData={getAllSheetsData}
            />

            <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

            <button
              onClick={toggleMap}
              title="Dependency map (Ctrl+M)"
              className={[
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors',
                showMap
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              <Network className="h-3 w-3" aria-hidden="true" />
              Map
            </button>

            <ThemeToggle />
          </div>
        </header>

        <MenuBar handlers={menuHandlers} />

        <FormattingToolbar
          onSortAsc={() => handleQuickSort('asc')}
          onSortDesc={() => handleQuickSort('desc')}
          onFilter={() => setShowFilter(true)}
        />

      <FormulaBar />

      <NLFilterBar columnSchema={nlFilterColumnSchema} sampleData={nlFilterSampleData} />

      <div className="relative flex-1 overflow-hidden">
        <SpreadsheetGrid
          workbookId={workbookId}
          onOpenColumnDNA={columnDNA.openPanel}
          onSummarizeRows={rowSummarizer.open}
          onViewCellHistory={cellHistory.openHistory}
        />
        {showMap && (
          <DependencyMap
            sheetData={gridSheets}
            onCellSelect={handleDependencyCellSelect}
            onExit={() => setShowMap(false)}
          />
        )}
      </div>

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
      </div>
    </main>
  )
}
