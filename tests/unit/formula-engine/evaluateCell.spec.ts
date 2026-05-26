import { describe, it, expect } from 'vitest'
import { evaluateCell, extractCellReferences, isValidFormula } from '@/features/formula-engine/formulaEngine'
import type { Sheet } from '@fortune-sheet/core'

function makeSheet(name: string, celldata: { r: number; c: number; v: { v?: string | number; f?: string } }[]): Sheet {
  return {
    name,
    id: name.toLowerCase(),
    status: 1,
    order: 0,
    hide: 0,
    row: 50,
    column: 26,
    celldata,
  }
}

describe('evaluateCell (adapter-backed)', () => {
  it('evaluates SUM over a range', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', [
        { r: 0, c: 0, v: { v: 10 } },
        { r: 0, c: 1, v: { v: 20 } },
        { r: 0, c: 2, v: { v: 30 } },
      ]),
    ]
    const result = evaluateCell('=SUM(A1:C1)', sheets, 1, 0)
    expect(result).toBe(60)
  })

  it('evaluates IF that returns text', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', [{ r: 0, c: 0, v: { v: 5 } }]),
    ]
    expect(evaluateCell('=IF(A1>3,"High","Low")', sheets, 1, 0)).toBe('High')
  })

  it('returns the literal back for non-formula text', () => {
    const sheets: Sheet[] = [makeSheet('Sheet1', [])]
    expect(evaluateCell('hello', sheets, 0, 0)).toBe('hello')
  })
})

describe('extractCellReferences', () => {
  it('extracts singletons and ranges', () => {
    expect(extractCellReferences('=SUM(A1:B5) + C10')).toEqual(['A1', 'B5', 'C10'])
  })
  it('deduplicates references', () => {
    expect(extractCellReferences('=A1+A1+A1')).toEqual(['A1'])
  })
})

// ─── MVP P1 #25: Advanced formulas ─────────────────────────────────────
// SUMIF/SUMIFS/COUNTIF/COUNTIFS/UNIQUE/FILTER are listed as P1
// requirements in the QuikSheets MVP spec. These pin the contract so
// HyperFormula version bumps can't regress them silently.
describe('advanced formulas (MVP P1 #25)', () => {
  it('SUMIF — total only rows matching a single condition', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', [
        { r: 0, c: 0, v: { v: 'Apple'  } }, { r: 0, c: 1, v: { v: 10 } },
        { r: 1, c: 0, v: { v: 'Banana' } }, { r: 1, c: 1, v: { v: 20 } },
        { r: 2, c: 0, v: { v: 'Apple'  } }, { r: 2, c: 1, v: { v: 30 } },
      ]),
    ]
    expect(evaluateCell('=SUMIF(A1:A3,"Apple",B1:B3)', sheets, 3, 0)).toBe(40)
  })

  it('SUMIFS — multi-criteria sum (P1 #25 spec example)', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', [
        // Region | Category | Amount
        { r: 0, c: 0, v: { v: 'North' } }, { r: 0, c: 1, v: { v: 'A' } }, { r: 0, c: 2, v: { v: 100 } },
        { r: 1, c: 0, v: { v: 'North' } }, { r: 1, c: 1, v: { v: 'B' } }, { r: 1, c: 2, v: { v: 200 } },
        { r: 2, c: 0, v: { v: 'South' } }, { r: 2, c: 1, v: { v: 'A' } }, { r: 2, c: 2, v: { v: 300 } },
        { r: 3, c: 0, v: { v: 'North' } }, { r: 3, c: 1, v: { v: 'A' } }, { r: 3, c: 2, v: { v: 400 } },
      ]),
    ]
    // North + A → rows 0 and 3 → 100 + 400 = 500
    expect(evaluateCell('=SUMIFS(C1:C4,A1:A4,"North",B1:B4,"A")', sheets, 5, 0)).toBe(500)
  })

  it('COUNTIF — count rows matching a single condition', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', [
        { r: 0, c: 0, v: { v: 'Active'   } },
        { r: 1, c: 0, v: { v: 'Inactive' } },
        { r: 2, c: 0, v: { v: 'Active'   } },
        { r: 3, c: 0, v: { v: 'Active'   } },
      ]),
    ]
    expect(evaluateCell('=COUNTIF(A1:A4,"Active")', sheets, 5, 0)).toBe(3)
  })

  it('COUNTIFS — count rows matching multiple conditions', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', [
        { r: 0, c: 0, v: { v: 'North' } }, { r: 0, c: 1, v: { v: 'A' } },
        { r: 1, c: 0, v: { v: 'North' } }, { r: 1, c: 1, v: { v: 'B' } },
        { r: 2, c: 0, v: { v: 'South' } }, { r: 2, c: 1, v: { v: 'A' } },
        { r: 3, c: 0, v: { v: 'North' } }, { r: 3, c: 1, v: { v: 'A' } },
      ]),
    ]
    // North + A → 2 rows
    expect(evaluateCell('=COUNTIFS(A1:A4,"North",B1:B4,"A")', sheets, 5, 0)).toBe(2)
  })
})

// ─── MVP P1 #27: Cross-sheet references ────────────────────────────────
// `=Sheet2!B2` must resolve to Sheet2's B2 value, not #REF! / #NAME!.
// The HyperFormula adapter builds a fresh instance from the full
// workbook on every eval, so newly-added sheets are picked up
// automatically — this test pins that contract.
describe('cross-sheet references (MVP P1 #27)', () => {
  it('=Sheet2!B2 mirrors the value from Sheet2', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', []),
      makeSheet('Sheet2', [{ r: 1, c: 1, v: { v: 42 } }]),
    ]
    // Evaluated from Sheet1 (sheetIndex 0), reading B2 of Sheet2.
    expect(evaluateCell('=Sheet2!B2', sheets, 0, 0, 0)).toBe(42)
  })

  it('cross-sheet SUM works on a range from another sheet', () => {
    const sheets: Sheet[] = [
      makeSheet('Sheet1', []),
      makeSheet('Sheet2', [
        { r: 0, c: 0, v: { v: 1 } },
        { r: 1, c: 0, v: { v: 2 } },
        { r: 2, c: 0, v: { v: 3 } },
      ]),
    ]
    expect(evaluateCell('=SUM(Sheet2!A1:A3)', sheets, 0, 0, 0)).toBe(6)
  })

  it('newly-added sheet is reachable on the next eval (no singleton stale-cache)', () => {
    // First eval with two sheets.
    const sheetsBefore: Sheet[] = [
      makeSheet('Sheet1', []),
      makeSheet('Sheet2', [{ r: 0, c: 0, v: { v: 10 } }]),
    ]
    expect(evaluateCell('=Sheet2!A1', sheetsBefore, 0, 0, 0)).toBe(10)

    // Then add a third sheet and reference it in the next eval. If the
    // adapter caches a stale HyperFormula instance, this returns #REF!
    // — which is the regression we want to catch.
    const sheetsAfter: Sheet[] = [
      ...sheetsBefore,
      makeSheet('Sheet3', [{ r: 0, c: 0, v: { v: 99 } }]),
    ]
    expect(evaluateCell('=Sheet3!A1', sheetsAfter, 0, 0, 0)).toBe(99)
  })
})

describe('isValidFormula', () => {
  it('accepts a well-formed formula', () => {
    expect(isValidFormula('=SUM(A1:A5)')).toBe(true)
  })
  it('rejects a value without a leading =', () => {
    expect(isValidFormula('SUM(A1:A5)')).toBe(false)
  })
  it('rejects an empty body', () => {
    expect(isValidFormula('=')).toBe(false)
    expect(isValidFormula('=   ')).toBe(false)
  })
  it('rejects a syntactically broken formula', () => {
    expect(isValidFormula('=SUM(')).toBe(false)
  })
})
