import { describe, it, expect } from 'vitest'
import type { Sheet } from '@fortune-sheet/core'
import { coerceDateCells } from '@/features/grid/utils/coerceDateCells'
import { getSheetMatrix } from '@/lib/fortuneSheet'

function sheetWith(cells: Record<string, unknown>): Sheet {
  // cells keyed "r,c"
  const data: unknown[][] = [[], []]
  for (const [k, v] of Object.entries(cells)) {
    const [r, c] = k.split(',').map(Number)
    while (data.length <= r!) data.push([])
    const row = data[r!]!
    while (row.length <= c!) row.push(null)
    row[c!] = v
  }
  return { id: 's1', name: 'Sheet1', data } as unknown as Sheet
}

describe('coerceDateCells', () => {
  it('upgrades a typed date string to a serial date cell (t:n number)', () => {
    const sheet = sheetWith({ '0,0': { v: 'Hire date', m: 'Hire date' }, '1,0': { v: '01-04-2026', m: '01-04-2026' } })
    const [out] = coerceDateCells([sheet], [{ sheetId: 's1', row: 1, col: 0, value: '01-04-2026' }])
    const cell = getSheetMatrix(out!)[1]![0] as { v: number; m: string; ct: { fa: string; t: string } }
    expect(cell.v).toBe(46113)
    expect(cell.m).toBe('01-04-2026')
    expect(cell.ct).toEqual({ fa: 'dd-mm-yyyy', t: 'n' })
  })

  it('leaves the header cell untouched', () => {
    const sheet = sheetWith({ '0,0': { v: 'Hire date', m: 'Hire date' }, '1,0': { v: '01-04-2026', m: '01-04-2026' } })
    const [out] = coerceDateCells([sheet], [{ sheetId: 's1', row: 1, col: 0, value: '01-04-2026' }])
    expect(getSheetMatrix(out!)[0]![0]).toEqual({ v: 'Hire date', m: 'Hire date' })
  })

  it('returns the SAME array reference when no target is a date', () => {
    const sheet = sheetWith({ '0,0': { v: 'hello', m: 'hello' } })
    const input = [sheet]
    expect(coerceDateCells(input, [{ sheetId: 's1', row: 0, col: 0, value: 'hello' }])).toBe(input)
  })

  it('returns the SAME array reference for empty targets', () => {
    const input = [sheetWith({ '0,0': { v: '01-04-2026', m: '01-04-2026' } })]
    expect(coerceDateCells(input, [])).toBe(input)
  })

  it('only rewrites the sheet that has a coerced cell', () => {
    const s1 = sheetWith({ '0,0': { v: '01-04-2026', m: '01-04-2026' } })
    const s2 = { id: 's2', name: 'Other', data: [[{ v: 'x', m: 'x' }]] } as unknown as Sheet
    const out = coerceDateCells([s1, s2], [{ sheetId: 's1', row: 0, col: 0, value: '01-04-2026' }])
    expect(out[1]).toBe(s2) // untouched sheet kept by reference
    expect(out[0]).not.toBe(s1) // coerced sheet rebuilt
  })
})
