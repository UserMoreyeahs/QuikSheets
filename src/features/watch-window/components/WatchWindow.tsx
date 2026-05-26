'use client'

/**
 * WatchWindow — Formulas > Watch Window.
 *
 * Floating panel that pins specific cells and shows their live value +
 * formula. Updates automatically as cells change because the panel
 * subscribes to gridSheets and reads through getCellDisplayValue /
 * getSheetMatrix at render time.
 *
 * Click a row → navigate to that cell (select it, activate its sheet).
 * X on a row → remove from watch.
 * "Add Selected" button → adds the currently-selected cell to the watch.
 */

import { X, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useWatchWindowStore, type WatchedCell } from '../store/watchWindowStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { colIndexToLetter } from '@/lib/cellAddress'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'

interface RowProps {
  cell: WatchedCell
  onJump:   (cell: WatchedCell) => void
  onRemove: (id: string) => void
}

function WatchRow({ cell, onJump, onRemove }: RowProps) {
  const gridSheets = useSheetStore((s) => s.gridSheets)
  const sheet = gridSheets.find((s) => s.id === cell.sheetId)
  const matrix = sheet ? getSheetMatrix(sheet) : null
  const raw = matrix?.[cell.row]?.[cell.col] ?? null
  const display = raw ? getCellDisplayValue(raw) : null
  const formula = (raw as { f?: unknown } | null)?.f
  const sheetName = sheet?.name ?? '(missing sheet)'
  const addr = `${colIndexToLetter(cell.col)}${cell.row + 1}`

  return (
    <li className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
          <span className="truncate font-medium">{sheetName}</span>
          <span className="shrink-0 rounded bg-blue-50 px-1 py-0.5 font-mono text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {addr}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-900 dark:text-zinc-100" title={display === null ? '(empty)' : String(display)}>
          {display === null || display === '' ? <em className="text-zinc-400">empty</em> : String(display)}
        </div>
        {typeof formula === 'string' && formula && (
          <div className="truncate font-mono text-[10px] text-emerald-700 dark:text-emerald-400" title={formula}>
            {formula}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onJump(cell)}
        aria-label="Jump to cell"
        title="Jump to cell"
        className="self-start rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(cell.id)}
        aria-label="Remove watch"
        title="Remove watch"
        className="self-start rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

export function WatchWindow() {
  const open = useWatchWindowStore((s) => s.open)
  const close = useWatchWindowStore((s) => s.closePanel)
  const cells = useWatchWindowStore((s) => s.cells)
  const addCell = useWatchWindowStore((s) => s.addCell)
  const removeCell = useWatchWindowStore((s) => s.removeCell)
  const clearAll = useWatchWindowStore((s) => s.clear)

  if (!open) return null

  function addSelected() {
    const { selectedCell } = useSheetStore.getState()
    const { activeSheetId } = useWorkbookStore.getState()
    if (!selectedCell || !activeSheetId) {
      toast.message('Select a cell first.')
      return
    }
    addCell(activeSheetId, selectedCell.row, selectedCell.col)
    toast.success(`Watching ${colIndexToLetter(selectedCell.col)}${selectedCell.row + 1}`)
  }

  function jumpTo(c: WatchedCell) {
    // Activate the cell's sheet first
    const wb = useWorkbookStore.getState()
    if (c.sheetId !== wb.activeSheetId) {
      wb.setActiveSheet(c.sheetId)
    }
    // Defer selection one tick so the new sheet's grid mounts.
    setTimeout(() => {
      const sheet = useSheetStore.getState()
      // CellAddress in types/sheet.types.ts requires a `sheet` index field.
      // We look up the index of the target sheet from gridSheets so the
      // selection lands on the right sheet inside FortuneSheet.
      const sheetIdx = Math.max(0, sheet.gridSheets.findIndex((s) => s.id === c.sheetId))
      sheet.setSelectedCell({ row: c.row, col: c.col, sheet: sheetIdx })
      sheet.setSelectedRange({
        start: { row: c.row, col: c.col, sheet: sheetIdx },
        end:   { row: c.row, col: c.col, sheet: sheetIdx },
      })
      try {
        const inst = (sheet as unknown as { gridInstance?: { setSelection?: (r: unknown) => void } }).gridInstance
        inst?.setSelection?.([{ row: [c.row, c.row], column: [c.col, c.col] }])
      } catch { /* tolerate older FortuneSheet versions */ }
    }, 40)
  }

  return (
    <div
      className="absolute left-2 bottom-12 z-40 flex w-80 flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="watch-window"
      style={{ maxHeight: '60vh' }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">
          Watch Window
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={addSelected}
            title="Add the currently-selected cell"
            className="flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" /> Add selected
          </button>
          {cells.length > 0 && (
            <button
              type="button"
              onClick={() => { clearAll(); toast.message('Watch list cleared') }}
              aria-label="Clear all"
              title="Clear all watches"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close watch window"
            title="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto">
        {cells.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] italic text-zinc-400">
            No watches yet. Select a cell and click <strong className="font-semibold not-italic">Add selected</strong> to pin its live value here.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {cells.map((c) => (
              <WatchRow key={c.id} cell={c} onJump={jumpTo} onRemove={removeCell} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
