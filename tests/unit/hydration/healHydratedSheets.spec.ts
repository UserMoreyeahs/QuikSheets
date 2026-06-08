import { describe, it, expect } from 'vitest'
import type { Sheet, Cell } from '@fortune-sheet/core'
import { healHydratedSheets } from '@/lib/healHydratedSheets'

/**
 * Pins the hydration self-heal for workbooks saved BEFORE the formula-seed fix:
 * formula `f` with a leading "=" and/or no cached value rendered BLANK. After
 * the heal they must carry a normalized `f` (no "=") and a clean cached value.
 */
const c = (v: string): Cell => ({ v, m: v })
const n = (v: number): Cell => ({ v, m: String(v) })

function sheetFromData(data: (Cell | null)[][]): Sheet {
  return { id: 'sheet1', name: 'Sheet1', status: 1, order: 0, hide: 0, row: 10, column: 6, data }
}

/** Pull the healed cell at (r,c) from the returned sheet's data matrix. */
function cellAt(sheets: Sheet[], r: number, col: number): Cell | null {
  return (sheets[0]?.data?.[r]?.[col] ?? null) as Cell | null
}

describe('healHydratedSheets', () => {
  it('strips a leading "=" and computes the value for a blank Revenue formula', () => {
    const broken = sheetFromData([
      [c('Product'), c('Region'), c('Units'), c('Unit Price'), c('Revenue'), null],
      [c('Widget A'), c('North'), n(120), n(9.99), { f: '=C2*D2' } as Cell, null],
      [c('Widget B'), c('South'), n(85), n(14.5), { f: '=C3*D3' } as Cell, null],
    ])
    const healed = healHydratedSheets([broken])
    const e2 = cellAt(healed, 1, 4)
    expect(e2?.f).toBe('C2*D2') // leading "=" stripped
    expect(typeof e2?.v).toBe('number')
    expect(e2?.v as number).toBeCloseTo(1198.8, 6)
    expect(e2?.m).toBe('1198.8') // clean display, no binary-float noise
    const e3 = cellAt(healed, 2, 4)
    expect(e3?.v as number).toBeCloseTo(1232.5, 6)
  })

  it('computes SUM formulas that reference other (formula) cells', () => {
    const broken = sheetFromData([
      [c('Product'), c('Region'), c('Units'), c('Unit Price'), c('Revenue'), null],
      [c('Widget A'), c('North'), n(120), n(9.99), { f: '=C2*D2' } as Cell, null],
      [c('Widget B'), c('South'), n(85), n(14.5), { f: '=C3*D3' } as Cell, null],
      [null, null, null, null, null, null],
      [c('Total'), null, { f: '=SUM(C2:C3)' } as Cell, null, { f: '=SUM(E2:E3)' } as Cell, null],
    ])
    const healed = healHydratedSheets([broken])
    expect(cellAt(healed, 4, 2)?.v as number).toBeCloseTo(205, 6) // 120 + 85
    expect(cellAt(healed, 4, 4)?.v as number).toBeCloseTo(2431.3, 6) // 1198.8 + 1232.5
  })

  it('leaves an already-correct workbook untouched (same reference)', () => {
    const healthy = sheetFromData([
      [c('A'), c('B'), null],
      [n(2), n(3), { f: 'A2*B2', v: 6, m: '6' } as Cell],
    ])
    const result = healHydratedSheets([healthy])
    // No-op: the same sheet instance is returned when nothing needs healing.
    expect(result[0]).toBe(healthy)
  })

  it('strips a leading "=" even when the value is already cached (no recompute)', () => {
    const broken = sheetFromData([
      [n(2), n(3), { f: '=A1*B1', v: 6, m: '6' } as Cell],
    ])
    const healed = healHydratedSheets([broken])
    const cell = cellAt(healed, 0, 2)
    expect(cell?.f).toBe('A1*B1')
    expect(cell?.v).toBe(6) // untouched
  })

  it('does not bake an error string into a cell on a broken reference', () => {
    const broken = sheetFromData([
      [c('text'), { f: '=A1*2' } as Cell], // "text" * 2 → error
    ])
    const healed = healHydratedSheets([broken])
    const cell = cellAt(healed, 0, 1)
    expect(cell?.f).toBe('A1*2')
    // value left unset (no "#VALUE!"/"#ERROR!" baked in) — grid surfaces it.
    expect(cell?.v == null || typeof cell?.v === 'number').toBe(true)
  })
})
