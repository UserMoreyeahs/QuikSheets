import type { Sheet, Cell, CellWithRowAndCol } from '@fortune-sheet/core'
import { DEFAULT_ROWS, DEFAULT_COLS } from '@/lib/constants'

export function createDefaultSheet(
  name: string = 'Sheet1',
  id: string = 'sheet1'
): Sheet {
  return {
    name,
    id,
    status: 1,
    order: 0,
    hide: 0,
    row: DEFAULT_ROWS,
    column: DEFAULT_COLS,
    celldata: [],
  }
}

export function createDefaultWorkbook(): Sheet[] {
  return [createDefaultSheet('Sheet1', 'sheet1')]
}

/**
 * A brand-new workbook seeded with a small, friendly sample table so the
 * first-run experience isn't a blank grid (and so it's immediately
 * obvious that data entry + formulas work).
 *
 * Kept SEPARATE from createDefaultWorkbook() on purpose: the empty
 * default is load-bearing for import-detection (importing into a fresh,
 * empty single-sheet workbook REPLACES the sheet rather than appending).
 * This sample is only written into the new-workbook creation flow via
 * the `quiksheets_template_data:<id>` hydration path.
 *
 * Uses FortuneSheet `celldata` (sparse) — the same shape templates use —
 * so it hydrates through the existing replaceGridSheets() remount path.
 * Formula cells use `f`; FortuneSheet computes their values on mount.
 */
export function createSampleWorkbook(): Sheet[] {
  const header = (v: string): Cell => ({ v, m: v, bl: 1, bg: '#eef2ff', fc: '#1e293b' })
  const txt = (v: string): Cell => ({ v, m: v })
  const num = (v: number): Cell => ({ v, m: String(v) })
  const formula = (f: string): Cell => ({ f })

  const rows: Array<Array<Cell | null>> = [
    [header('Product'), header('Region'), header('Units'), header('Unit Price'), header('Revenue')],
    [txt('Widget A'), txt('North'), num(120), num(9.99), formula('=C2*D2')],
    [txt('Widget B'), txt('South'), num(85), num(14.5), formula('=C3*D3')],
    [txt('Gadget C'), txt('East'), num(210), num(7.25), formula('=C4*D4')],
    [txt('Gadget D'), txt('West'), num(64), num(19), formula('=C5*D5')],
    [null, null, null, null, null],
    [{ v: 'Total', m: 'Total', bl: 1 }, null, formula('=SUM(C2:C5)'), null, formula('=SUM(E2:E5)')],
  ]

  const celldata: CellWithRowAndCol[] = []
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) celldata.push({ r, c, v: cell })
    })
  })

  // Build the FULL 2-D `data` matrix too. FortuneSheet RENDERS from `data`
  // when hydrating via the data prop — a celldata-only sheet shows blank
  // (see the "data + celldata must update in lockstep" note in CLAUDE.md).
  // Providing both is what the import/template paths effectively rely on.
  const data: (Cell | null)[][] = Array.from({ length: DEFAULT_ROWS }, (_unused, r) =>
    Array.from({ length: DEFAULT_COLS }, (_unused2, c) => rows[r]?.[c] ?? null),
  )

  return [
    {
      name: 'Sheet1',
      id: 'sheet1',
      status: 1,
      order: 0,
      hide: 0,
      row: DEFAULT_ROWS,
      column: DEFAULT_COLS,
      data,
      celldata,
    },
  ]
}
