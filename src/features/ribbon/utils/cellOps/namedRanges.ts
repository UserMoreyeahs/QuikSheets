'use client'

/**
 * Named-range cell operations: define / list / insert / create-from-selection.
 *
 * Extracted from src/features/ribbon/utils/cellOps.ts (Wave 4 split).
 * Public API is re-exported from cellOps.ts for back-compat — all existing
 * call sites stay byte-identical.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { promptDialog } from '@/components/PromptDialog'
import { useNamedRangesStore, validateNamedRangeName } from '@/features/named-ranges/namedRangesStore'
import { colIndexToLetter } from './shared'

/**
 * Open the Name Manager dialog. Idempotent.
 */
export function openNameManager(): void {
  useNamedRangesStore.getState().setDialogOpen(true)
}

/**
 * Define a new name from the current selection (prompt-based).
 */
export async function defineNameFromSelection(workbookId: string): Promise<void> {
  const { selectedCell, selectedRange } = useSheetStore.getState()
  if (!selectedCell) {
    toast.error('Select a range first')
    return
  }
  const sr = selectedRange ? Math.min(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const er = selectedRange ? Math.max(selectedRange.start.row, selectedRange.end.row) : selectedCell.row
  const sc = selectedRange ? Math.min(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const ec = selectedRange ? Math.max(selectedRange.start.col, selectedRange.end.col) : selectedCell.col
  const range = `${colIndexToLetter(sc)}${sr + 1}:${colIndexToLetter(ec)}${er + 1}`

  const name = await promptDialog({
    title: 'Define a name for this range',
    message: `Range: ${range}. Use letters, digits, and underscores (no spaces).`,
    placeholder: 'e.g. TotalRevenue',
  })
  if (!name) return
  const v = validateNamedRangeName(name)
  if (!v.ok) {
    toast.error(v.error ?? 'Invalid name')
    return
  }
  useNamedRangesStore.getState().addName(workbookId, {
    name,
    range,
    scope: 'workbook',
  })
  toast.success(`Defined "${name}" → ${range}`)
}

/**
 * Show a list of names; clicking one inserts its RANGE (not the name) into
 * the formula bar at the active cell. We insert the resolved range because
 * formulajs (the engine FortuneSheet uses) doesn't natively support named
 * range substitution — the foundation is here for a future iter to plumb that
 * through the evaluator.
 */
export async function insertNameIntoFormula(workbookId: string): Promise<void> {
  const names = useNamedRangesStore.getState().getNamesForWorkbook(workbookId)
  if (names.length === 0) {
    toast.message('No defined names. Open Name Manager (Ctrl+F3) to add one.')
    return
  }
  const labels = names.map((n, i) => `${i + 1}. ${n.name} = ${n.range}`).join('\n')
  const choice = await promptDialog({
    title: 'Insert a named range',
    message: `Type the number of the name to insert:\n${labels}`,
    defaultValue: '1',
    inputType: 'number',
  })
  if (!choice) return
  const idx = parseInt(choice, 10) - 1
  const target = names[idx]
  if (!target) {
    toast.error('Invalid choice')
    return
  }
  const { setFormulaBarValue, setEditingCell, selectedCell, formulaBarValue } = useSheetStore.getState()
  // Append the range to whatever's already in the bar
  const next = (formulaBarValue ?? '') + target.range
  setFormulaBarValue(next)
  if (selectedCell) setEditingCell(selectedCell)
}

/**
 * Walks the active sheet's selected range. If row 1 has headers, creates a name
 * for each column with the header-as-name and the rest of the column as range.
 * Mirrors Excel's "Create from Selection" with "Top row" option.
 */
export function createNamesFromSelection(workbookId: string): void {
  const { selectedCell, selectedRange, gridSheets } = useSheetStore.getState()
  if (!selectedCell || !selectedRange) {
    toast.error('Select a range with headers')
    return
  }
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  if (er === sr) {
    toast.error('Selection must include header row + at least one data row')
    return
  }

  const sheet = gridSheets[selectedCell.sheet]
  if (!sheet) return
  const matrix = sheet.data
  if (!matrix) return

  let added = 0
  let skipped = 0
  for (let c = sc; c <= ec; c++) {
    const headerCell = matrix[sr]?.[c] as { v?: unknown } | undefined
    const header = String(headerCell?.v ?? '').trim()
    if (!header) {
      skipped++
      continue
    }
    // Sanitize: replace spaces with underscores; reject if still invalid
    const sanitized = header.replace(/\s+/g, '_')
    const v = validateNamedRangeName(sanitized)
    if (!v.ok) {
      skipped++
      continue
    }
    const range = `${colIndexToLetter(c)}${sr + 2}:${colIndexToLetter(c)}${er + 1}`
    useNamedRangesStore.getState().addName(workbookId, {
      name: sanitized,
      range,
      scope: 'workbook',
    })
    added++
  }
  toast.success(`Created ${added} name${added === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}`)
}
