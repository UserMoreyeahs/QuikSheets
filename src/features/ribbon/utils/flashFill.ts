'use client'

/**
 * Flash Fill — Excel's Ctrl+E feature.
 *
 * Detects the user's intent from a few example transformations and
 * fills the rest of the column. Works in three phases:
 *
 *   1. SCOPE DETECTION
 *      Walk up from the active cell in the same column to find the
 *      contiguous "example" block (non-empty cells). Walk down to
 *      find the first contiguous block of empty cells that we'll
 *      fill. The "source" is the column immediately to the LEFT of
 *      the active column (Excel's default when no source is named).
 *
 *   2. AI INFERENCE
 *      POST source rows + example outputs to /api/ai/flash-fill. The
 *      server uses Groq + a strict JSON-array system prompt to return
 *      one value per row.
 *
 *   3. APPLY
 *      Write only the empty-cell results back to the grid. Examples
 *      the user typed are left untouched (the API echoes them so we
 *      can verify but we never overwrite).
 *
 * If the API isn't reachable (no GROQ_API_KEY, network error), the
 * helper surfaces a toast and bails — Flash Fill is a soft feature,
 * never block the user.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { getSheetMatrix } from '@/lib/fortuneSheet'
import type { Sheet } from '@fortune-sheet/core'

interface FillScope {
  /** Target column where we'll write fills. */
  col: number
  /** Source column index (immediately to the left of `col`). */
  sourceCol: number
  /** First row that contains an example value (or the active row if none). */
  firstRow: number
  /** Last row in the scope — bounded by either the last source row or 200. */
  lastRow: number
  /** Indices of cells in [firstRow..lastRow] that already have values (= examples). */
  exampleRows: number[]
  /** Indices of cells in [firstRow..lastRow] that are empty (= to fill). */
  emptyRows: number[]
}

const MAX_FILL_ROWS = 200

function getCellText(cell: unknown): string {
  if (cell == null) return ''
  const c = cell as { v?: unknown; m?: string }
  if (typeof c.m === 'string' && c.m !== '') return c.m
  if (c.v == null) return ''
  return String(c.v)
}

/**
 * Determine the Flash Fill scope from the active selection.
 *
 * Strategy (matches Excel's behavior):
 *   - Active column is where we write. Source is column to its left.
 *   - Walk UP from active row until a non-empty cell is found — that's
 *     the start of the example block. Track every non-empty cell
 *     between there and the active row as an "example".
 *   - The fill region extends DOWNWARD from the active row until either
 *     (a) we hit a row where the SOURCE column is empty (no more data),
 *     (b) we hit a non-empty cell in the target column that breaks the
 *         empty run, or
 *     (c) MAX_FILL_ROWS rows have been scoped.
 */
function detectScope(sheet: Sheet): FillScope | null {
  const { selectedCell } = useSheetStore.getState()
  if (!selectedCell) return null
  const col = selectedCell.col
  if (col === 0) return null // no source column to the left
  const sourceCol = col - 1

  const matrix = getSheetMatrix(sheet)

  // Walk up to find the first example.
  let firstRow = selectedCell.row
  for (let r = selectedCell.row; r >= 0; r--) {
    const text = getCellText(matrix[r]?.[col])
    if (text === '') break
    firstRow = r
  }

  // Track example/empty rows from firstRow down, bounded by source.
  const exampleRows: number[] = []
  const emptyRows: number[] = []
  let lastRow = firstRow

  for (let r = firstRow; r < matrix.length && r - firstRow < MAX_FILL_ROWS; r++) {
    const srcText = getCellText(matrix[r]?.[sourceCol])
    if (srcText === '') {
      // No more source data — stop here.
      break
    }
    const tgtText = getCellText(matrix[r]?.[col])
    if (tgtText === '') {
      emptyRows.push(r)
    } else {
      exampleRows.push(r)
    }
    lastRow = r
  }

  return { col, sourceCol, firstRow, lastRow, exampleRows, emptyRows }
}

/**
 * Public entry point. Detects the scope and runs Flash Fill.
 *
 * Returns silently when:
 *   - No active cell, OR cell is in column A (no source to the left)
 *   - Fewer than 1 example value above the active cell
 *   - No empty cells to fill below
 */
export async function flashFill(): Promise<void> {
  const { gridInstance, gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  if (!gridInstance) {
    toast.message('Grid not ready')
    return
  }
  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) return

  const scope = detectScope(sheet)
  if (!scope) {
    toast.message('Click a cell next to your source column first')
    return
  }
  if (scope.exampleRows.length === 0) {
    toast.message('Type at least one example value to show the pattern, then press Ctrl+E')
    return
  }
  if (scope.emptyRows.length === 0) {
    toast.message('Nothing to fill — all rows already have values')
    return
  }

  const matrix = getSheetMatrix(sheet)

  // Build source rows and parallel examples array. Source rows are a
  // single-cell wrapper for now; future enhancement could include
  // multiple source columns when present.
  const source: string[][] = []
  const examples: string[] = []
  for (let r = scope.firstRow; r <= scope.lastRow; r++) {
    source.push([getCellText(matrix[r]?.[scope.sourceCol])])
    examples.push(getCellText(matrix[r]?.[scope.col]))
  }

  const fillingToast = toast.loading(
    `Flash Fill: detecting pattern from ${scope.exampleRows.length} example${scope.exampleRows.length === 1 ? '' : 's'}…`,
  )

  let response: { values?: string[]; pattern?: string; error?: string }
  try {
    const res = await fetch('/api/ai/flash-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, examples }),
    })
    response = await res.json().catch(() => ({ error: 'Server returned invalid JSON' }))
    if (!res.ok) {
      toast.dismiss(fillingToast)
      toast.error(`Flash Fill failed: ${response.error ?? `HTTP ${res.status}`}`)
      return
    }
  } catch (err) {
    toast.dismiss(fillingToast)
    toast.error(`Flash Fill network error: ${err instanceof Error ? err.message : 'unknown'}`)
    return
  }

  if (!response.values) {
    toast.dismiss(fillingToast)
    toast.error('Flash Fill returned no values')
    return
  }

  // Apply only to empty cells — never overwrite user-typed examples.
  let filled = 0
  const setVal = (gridInstance as unknown as {
    setCellValue: (r: number, c: number, v: unknown) => void
  }).setCellValue
  for (const rowIdx of scope.emptyRows) {
    const localIdx = rowIdx - scope.firstRow
    const val = response.values[localIdx]
    if (val == null || val === '') continue
    setVal(rowIdx, scope.col, val)
    filled++
  }

  toast.dismiss(fillingToast)
  if (filled === 0) {
    toast.warning('Flash Fill: pattern unclear — add more examples and try again')
  } else {
    toast.success(`Flash Fill: ${filled} row${filled === 1 ? '' : 's'} filled`)
  }
}
