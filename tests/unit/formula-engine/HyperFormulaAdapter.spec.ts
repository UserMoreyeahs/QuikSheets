import { describe, it, expect, beforeEach } from 'vitest'
import { HyperFormulaAdapter } from '@/features/formula/adapters/HyperFormulaAdapter'
import type { FormulaWorkbook } from '@/features/formula/FormulaEngineAdapter'

describe('HyperFormulaAdapter', () => {
  let adapter: HyperFormulaAdapter

  beforeEach(() => {
    adapter = new HyperFormulaAdapter()
  })

  function makeWorkbook(): FormulaWorkbook {
    return {
      sheets: {
        Sheet1: [
          [10, 20, 30],
          [40, 50, 60],
          ['=SUM(A1:C2)', null, null],
        ],
      },
      activeSheetName: 'Sheet1',
    }
  }

  it('evaluates SUM range correctly', () => {
    const result = adapter.evaluateFormula('=SUM(A1:C2)', {
      workbook: makeWorkbook(),
      cell: { sheetName: 'Sheet1', row: 2, col: 0 },
    })
    expect(result.ok).toBe(true)
    expect(result.value).toBe(210)
  })

  it('evaluates IF with branch', () => {
    const wb: FormulaWorkbook = {
      sheets: { Sheet1: [[5]] },
      activeSheetName: 'Sheet1',
    }
    const result = adapter.evaluateFormula('=IF(A1>3,"High","Low")', {
      workbook: wb,
      cell: { sheetName: 'Sheet1', row: 1, col: 0 },
    })
    expect(result.ok).toBe(true)
    expect(result.value).toBe('High')
  })

  it('returns ok=true for plain (non-formula) text', () => {
    const result = adapter.evaluateFormula('hello', {
      workbook: makeWorkbook(),
      cell: { sheetName: 'Sheet1', row: 0, col: 0 },
    })
    expect(result.ok).toBe(true)
    expect(result.value).toBe('hello')
  })

  it('validates a syntactically broken formula as ok=false', () => {
    const result = adapter.validateFormula('=SUM(')
    expect(result.ok).toBe(false)
  })

  it('reports supported functions', () => {
    const fns = adapter.getSupportedFunctions()
    expect(fns.length).toBeGreaterThan(50)
    expect(fns).toContain('SUM')
    expect(fns).toContain('IF')
    expect(fns).toContain('VLOOKUP')
  })
})
