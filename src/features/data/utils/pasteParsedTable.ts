'use client'

/**
 * pasteParsedTable — paste a parsed 2-D table into the active sheet
 * starting at the selected cell (or A1 if nothing is selected).
 *
 * Mirrors the dev-helper __qsSeed pattern in src/app/sheet/[id]/page.tsx:
 * we rebuild both `celldata` (the sparse list FortuneSheet uses for
 * iteration) AND the `data` 2-D matrix (FortuneSheet renders from this
 * when the workbook is hydrated via the `data` prop). Writing only one
 * leaves the grid out of sync.
 */

import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { CellValue } from './fromWebParser'

interface CellPayload {
  ct: { fa: string; t: string }
  m: string
  v: string | number | boolean
}

function buildCell(v: CellValue): CellPayload | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return { ct: { fa: 'General', t: 'n' }, m: String(v), v }
  if (typeof v === 'boolean') return { ct: { fa: 'General', t: 'b' }, m: String(v), v }
  return { ct: { fa: 'General', t: 'g' }, m: String(v), v: String(v) }
}

interface PasteResult {
  ok: boolean
  sheetId: string
  rowsPasted: number
  colsPasted: number
  anchorRow: number
  anchorCol: number
}

/**
 * Paste rows into the active sheet. Existing cells outside the paste
 * rectangle are preserved; cells inside the rectangle are overwritten.
 *
 * @param rows 2-D table of CellValue
 * @returns metadata about where the paste landed, or null on failure
 */
export function pasteParsedTable(rows: CellValue[][]): PasteResult | null {
  const sheetState = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const sheets = sheetState.gridSheets
  const targetIdx = sheets.findIndex((s) => s.id === activeSheetId)
  const target = targetIdx >= 0 ? sheets[targetIdx] : sheets.find((s) => s.status === 1)
  // FortuneSheet's Sheet.id is technically optional in the typings, but
  // every real sheet has one. Bail if we somehow get an id-less sheet
  // so the caller sees a clean failure rather than an empty toast.
  if (!target || !target.id) return null
  const targetId: string = target.id

  const anchorRow = sheetState.selectedCell?.row ?? 0
  const anchorCol = sheetState.selectedCell?.col ?? 0

  // Build the new matrix by copying the existing one and overwriting
  // cells inside the paste rectangle. Falls back to creating a fresh
  // 100×26 matrix if the sheet has no `data` array yet.
  type CellEntry = CellPayload | null
  const ROWS = Math.max(100, target.data?.length ?? 0)
  const COLS = Math.max(26, target.data?.[0]?.length ?? 0)
  const matrix: CellEntry[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c): CellEntry => {
      // Preserve existing cell payload, but coerce its shape to ours.
      // Existing cells come back as FortuneSheet's CellMap which has
      // a superset of our CellPayload fields — that's fine since we
      // re-emit the same object through the celldata loop unchanged.
      const existing = target.data?.[r]?.[c]
      return (existing ?? null) as CellEntry
    }),
  )

  rows.forEach((row, r) => {
    const absRow = anchorRow + r
    if (absRow >= ROWS) return
    row.forEach((v, c) => {
      const absCol = anchorCol + c
      if (absCol >= COLS) return
      matrix[absRow]![absCol] = buildCell(v)
    })
  })

  // Rebuild celldata from the matrix so the two stay in lockstep.
  const celldata: Array<{ r: number; c: number; v: CellEntry }> = []
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]!
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cell !== undefined && cell !== null) celldata.push({ r, c, v: cell })
    }
  }

  const nextSheets = sheets.map((s) =>
    s.id === target.id
      ? ({ ...s, celldata, data: matrix } as typeof s)
      : s,
  )
  sheetState.replaceGridSheets(nextSheets)

  const colsPasted = rows.reduce((m, r) => Math.max(m, r.length), 0)
  return {
    ok: true,
    sheetId: targetId,
    rowsPasted: rows.length,
    colsPasted,
    anchorRow,
    anchorCol,
  }
}
