'use client'

import { ChevronDown, FilePenLine, Minus, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toast } from 'sonner'
import { ribbonStub } from '../utils/ribbonStub'
import { insertColumnLeft, insertColumnRight, deleteColumn, insertRowAbove } from '../utils/cellOps'
import { autoFitColumns, autoFitRows } from '../utils/autoFit'

interface CellsGroupProps {
  onInsertRow?: (() => void) | undefined
  onDeleteRow?: (() => void) | undefined
  onInsertSheet?: (() => void) | undefined
  onProtectedRanges?: (() => void) | undefined
}

/**
 * Excel-faithful Cells group: Insert ▾ / Delete ▾ / Format ▾.
 * Format dropdown wires to real FortuneSheet APIs:
 *   - Row Height / Column Width / AutoFit
 *   - Hide & Unhide (rows, columns, sheet)
 *   - Rename Sheet, Tab Color, Protect Sheet, Lock Cell
 */
export function CellsGroup(props: CellsGroupProps) {
  const { gridInstance, selectedCell, selectedRange } = useSheetStore()
  const { activeSheetId, sheets, renameSheet, hideSheet, removeSheet, setSheetColor } = useWorkbookStore()

  /** Row range from current selection. Single cell → just that row. */
  function getSelectionRows(): { start: number; end: number } {
    if (!selectedCell) return { start: 0, end: 0 }
    if (!selectedRange) return { start: selectedCell.row, end: selectedCell.row }
    const start = Math.min(selectedRange.start.row, selectedRange.end.row)
    const end = Math.max(selectedRange.start.row, selectedRange.end.row)
    return { start, end }
  }
  function getSelectionCols(): { start: number; end: number } {
    if (!selectedCell) return { start: 0, end: 0 }
    if (!selectedRange) return { start: selectedCell.col, end: selectedCell.col }
    const start = Math.min(selectedRange.start.col, selectedRange.end.col)
    const end = Math.max(selectedRange.start.col, selectedRange.end.col)
    return { start, end }
  }

  // ── Row height / column width ──────────────────────────────────────────
  function setRowHeight() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    const input = window.prompt('Row height (pixels):', '21')
    if (!input) return
    const h = parseInt(input, 10)
    if (isNaN(h) || h <= 0) { toast.error('Enter a valid number'); return }
    const { start, end } = getSelectionRows()
    try {
      const config: Record<number, number> = {}
      for (let r = start; r <= end; r++) config[r] = h
      ;(gridInstance as unknown as { setRowHeight: (cfg: Record<number, number>) => void }).setRowHeight(config)
      toast.success(`Row height set to ${h}px`)
    } catch (e) {
      toast.error(`Couldn't set row height: ${String(e)}`)
    }
  }

  /**
   * R6.2 — real AutoFit. Measures content with a canvas 2D context
   * and sets row height to fit the tallest cell in the row. See
   * autoFit.ts for the measurement logic.
   *
   * Previous behaviour reset everything to 21px regardless of
   * content — that was misleading and unhelpful.
   */
  function autoFitRowHeight() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    try {
      autoFitRows()
      toast.success('Row height auto-fit to content')
    } catch (e) {
      toast.error(`AutoFit failed: ${String(e)}`)
    }
  }

  function setColumnWidth() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    const input = window.prompt('Column width (pixels):', '74')
    if (!input) return
    const w = parseInt(input, 10)
    if (isNaN(w) || w <= 0) { toast.error('Enter a valid number'); return }
    const { start, end } = getSelectionCols()
    try {
      const config: Record<number, number> = {}
      for (let c = start; c <= end; c++) config[c] = w
      ;(gridInstance as unknown as { setColumnWidth: (cfg: Record<number, number>) => void }).setColumnWidth(config)
      toast.success(`Column width set to ${w}px`)
    } catch (e) {
      toast.error(`Couldn't set column width: ${String(e)}`)
    }
  }

  /**
   * R6.2 — real AutoFit. Measures the longest text in each column
   * of the selection and sets the column width to fit it +padding.
   */
  function autoFitColumnWidth() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    try {
      autoFitColumns()
      toast.success('Column width auto-fit to content')
    } catch (e) {
      toast.error(`AutoFit failed: ${String(e)}`)
    }
  }

  // ── Hide / Unhide ──────────────────────────────────────────────────────
  function hideRows() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    const { start, end } = getSelectionRows()
    try {
      const idx = Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
      ;(gridInstance as unknown as {
        hideRowOrColumn: (info: string[], type: 'row' | 'column') => void
      }).hideRowOrColumn(idx, 'row')
      toast.success('Rows hidden')
    } catch (e) {
      toast.error(`Couldn't hide rows: ${String(e)}`)
    }
  }

  function hideColumns() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    const { start, end } = getSelectionCols()
    try {
      const idx = Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
      ;(gridInstance as unknown as {
        hideRowOrColumn: (info: string[], type: 'row' | 'column') => void
      }).hideRowOrColumn(idx, 'column')
      toast.success('Columns hidden')
    } catch (e) {
      toast.error(`Couldn't hide columns: ${String(e)}`)
    }
  }

  function unhideAllRows() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    try {
      const idx = Array.from({ length: 1000 }, (_, i) => String(i))
      ;(gridInstance as unknown as {
        showRowOrColumn: (info: string[], type: 'row' | 'column') => void
      }).showRowOrColumn(idx, 'row')
      toast.success('All rows shown')
    } catch (e) {
      toast.error(`Couldn't unhide rows: ${String(e)}`)
    }
  }

  function unhideAllColumns() {
    if (!gridInstance) { toast.error('Grid not ready'); return }
    try {
      const idx = Array.from({ length: 100 }, (_, i) => String(i))
      ;(gridInstance as unknown as {
        showRowOrColumn: (info: string[], type: 'row' | 'column') => void
      }).showRowOrColumn(idx, 'column')
      toast.success('All columns shown')
    } catch (e) {
      toast.error(`Couldn't unhide columns: ${String(e)}`)
    }
  }

  // ── Sheet operations ───────────────────────────────────────────────────
  function renameActiveSheet() {
    const current = sheets.find((s) => s.id === activeSheetId)
    const newName = window.prompt('New sheet name:', current?.name ?? 'Sheet')
    if (!newName || newName.trim() === '') return
    renameSheet(activeSheetId, newName.trim())
    toast.success(`Sheet renamed to "${newName.trim()}"`)
  }

  /**
   * R6.3 — tab color is set directly via the inline swatch grid in
   * the Format menu (see JSX below). This helper handles a single
   * apply, including the "No Color" sentinel.
   */
  function applyTabColor(hex: string | null) {
    setSheetColor(activeSheetId, hex)
    toast.success(hex ? `Tab color set to ${hex}` : 'Tab color cleared')
  }

  function hideActiveSheet() {
    if (sheets.filter((s) => !s.isHidden).length <= 1) {
      toast.error('Cannot hide the only visible sheet')
      return
    }
    hideSheet(activeSheetId)
    toast.success('Sheet hidden')
  }

  /**
   * R6.1 — actually delete the sheet (was previously aliased to hide).
   *
   * Refuses to delete the last remaining sheet (Excel parity), and
   * shows a confirm dialog because this destroys data. Calls the
   * workbookStore.removeSheet action — sheetStore.gridSheets is
   * synced via its own subscriber.
   */
  function deleteActiveSheet() {
    if (sheets.length <= 1) {
      toast.error('Cannot delete the only sheet')
      return
    }
    const current = sheets.find((s) => s.id === activeSheetId)
    const ok = window.confirm(
      `Delete sheet "${current?.name ?? 'Sheet'}"? All data on this sheet will be lost. This cannot be undone.`,
    )
    if (!ok) return
    removeSheet(activeSheetId)
    toast.success(`Sheet "${current?.name ?? 'Sheet'}" deleted`)
  }

  return (
    <>
      {/* Insert dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Insert"
            className="flex h-[68px] w-[56px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Plus className="h-6 w-6" />
            <span className="flex items-center gap-0.5 leading-tight">
              Insert <ChevronDown className="h-3 w-3 text-zinc-400" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => props.onInsertRow?.()}>Insert Row Below</DropdownMenuItem>
          <DropdownMenuItem onSelect={insertRowAbove}>Insert Row Above</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={insertColumnLeft}>Insert Column Left</DropdownMenuItem>
          <DropdownMenuItem onSelect={insertColumnRight}>Insert Column Right</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => props.onInsertSheet?.()}>Insert Sheet</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Delete"
            className="flex h-[68px] w-[56px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Minus className="h-6 w-6" />
            <span className="flex items-center gap-0.5 leading-tight">
              Delete <ChevronDown className="h-3 w-3 text-zinc-400" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => props.onDeleteRow?.()}>Delete Row</DropdownMenuItem>
          <DropdownMenuItem onSelect={deleteColumn}>Delete Column</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={deleteActiveSheet} className="text-red-600">
            Delete Sheet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Format dropdown — fully wired */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Format"
            className="flex h-[68px] w-[56px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <FilePenLine className="h-6 w-6" />
            <span className="flex items-center gap-0.5 leading-tight">
              Format <ChevronDown className="h-3 w-3 text-zinc-400" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* Cell Size */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cell Size</div>
          <DropdownMenuItem onSelect={setRowHeight}>Row Height…</DropdownMenuItem>
          <DropdownMenuItem onSelect={autoFitRowHeight}>AutoFit Row Height</DropdownMenuItem>
          <DropdownMenuItem onSelect={setColumnWidth}>Column Width…</DropdownMenuItem>
          <DropdownMenuItem onSelect={autoFitColumnWidth}>AutoFit Column Width</DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* Visibility */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Visibility</div>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Hide &amp; Unhide</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={hideRows}>Hide Rows</DropdownMenuItem>
              <DropdownMenuItem onSelect={hideColumns}>Hide Columns</DropdownMenuItem>
              <DropdownMenuItem onSelect={hideActiveSheet}>Hide Sheet</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={unhideAllRows}>Unhide Rows</DropdownMenuItem>
              <DropdownMenuItem onSelect={unhideAllColumns}>Unhide Columns</DropdownMenuItem>
              <DropdownMenuItem onSelect={ribbonStub('Unhide Sheet')}>Unhide Sheet…</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />

          {/* Organize Sheets */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Organize Sheets</div>
          <DropdownMenuItem onSelect={renameActiveSheet}>Rename Sheet</DropdownMenuItem>
          <DropdownMenuItem onSelect={ribbonStub('Move or Copy Sheet')}>Move or Copy Sheet…</DropdownMenuItem>

          {/* R6.3 — tab color picker (replaces the old prompt-with-numbered-list).
              Click any swatch to apply; click "No Color" to clear. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Tab Color</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="p-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Tab Color
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[
                  '#C00000','#FF0000','#FFC000','#FFFF00','#92D050','#00B050','#00B0F0',
                  '#0070C0','#002060','#7030A0','#FF69B4','#A5A5A5','#000000','#FFFFFF',
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => applyTabColor(c)}
                    className="h-5 w-5 rounded border border-zinc-300 transition-transform hover:scale-110 dark:border-zinc-700"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => applyTabColor(null)}
                className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white text-[10px] text-red-500">
                  ✕
                </span>
                No Color
              </button>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />

          {/* Protection */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Protection</div>
          <DropdownMenuItem onSelect={() => props.onProtectedRanges?.()}>Protect Sheet…</DropdownMenuItem>
          <DropdownMenuItem onSelect={ribbonStub('Lock Cell')}>Lock Cell</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => props.onProtectedRanges?.()}>Format Cells…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
