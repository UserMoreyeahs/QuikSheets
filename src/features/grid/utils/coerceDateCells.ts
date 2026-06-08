import type { Cell, Sheet } from '@fortune-sheet/core'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import { detectExcelDate } from './detectExcelDate'

/**
 * A freshly-committed plain-string cell that is a candidate for date coercion.
 * The caller filters these from the edit diff: string values, no formula, in an
 * untyped column (typed `date` columns have their own formatter).
 */
export interface DateTarget {
  sheetId: string
  row: number
  col: number
  value: string
}

/**
 * Excel-style date auto-detection: upgrade freshly-typed date strings (e.g.
 * "01-04-2026") to real date cells `{ v: serial, m: display, ct: { fa, t:'n' } }`
 * so they sort/calculate as dates and display formatted — matching Excel's
 * General-cell behavior. Dates are serial NUMBERS in Excel, hence `t:'n'` (the
 * same shape the app's number-format path uses).
 *
 * PURE + additive: only cells whose value strictly parses as a date are
 * touched; every other cell (and sheet) is returned unchanged by reference, so
 * a non-match degrades to today's behavior. Returns the original array when
 * nothing is coerced.
 */
export function coerceDateCells(sheets: Sheet[], targets: DateTarget[]): Sheet[] {
  if (targets.length === 0) return sheets

  const bySheet = new Map<string, { row: number; col: number; v: number; m: string; fa: string }[]>()
  for (const t of targets) {
    const d = detectExcelDate(t.value)
    if (!d) continue
    const list = bySheet.get(t.sheetId) ?? []
    list.push({ row: t.row, col: t.col, v: d.serial, m: d.display, fa: d.mask })
    bySheet.set(t.sheetId, list)
  }
  if (bySheet.size === 0) return sheets

  return sheets.map((sheet) => {
    const id = typeof sheet.id === 'string' ? sheet.id : undefined
    const list = id ? bySheet.get(id) : undefined
    if (!list || list.length === 0) return sheet

    const matrix = getSheetMatrix(sheet)
    const next = matrix.map((r) => [...(r ?? [])])
    for (const { row, col, v, m, fa } of list) {
      while (next.length <= row) next.push([])
      const r = next[row]!
      while (r.length <= col) r.push(null)
      r[col] = { v, m, ct: { fa, t: 'n' } } as Cell
    }
    return cloneSheetWithData(sheet, next)
  })
}
