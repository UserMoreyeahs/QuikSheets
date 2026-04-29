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
