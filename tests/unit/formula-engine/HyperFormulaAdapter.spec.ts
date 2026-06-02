import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HyperFormula } from 'hyperformula'
import { HyperFormulaAdapter } from '@/features/formula/adapters/HyperFormulaAdapter'
import { destroyHyperFormulaInstance } from '@/lib/hyperformula'
import type { FormulaWorkbook } from '@/features/formula/FormulaEngineAdapter'

describe('HyperFormulaAdapter', () => {
  let adapter: HyperFormulaAdapter

  beforeEach(() => {
    adapter = new HyperFormulaAdapter()
  })

  afterEach(() => {
    // Tear down the singleton so each test group starts clean
    destroyHyperFormulaInstance()
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

  // ── Pre-existing tests (kept verbatim) ────────────────────────────────────

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

  // ── (a) SUM / IF / VLOOKUP correctness with the singleton ────────────────

  describe('formula correctness (singleton)', () => {
    it('SUM over a column', () => {
      const wb: FormulaWorkbook = {
        sheets: {
          Sheet1: [
            [1],
            [2],
            [3],
            [4],
            [5],
          ],
        },
        activeSheetName: 'Sheet1',
      }
      const result = adapter.evaluateFormula('=SUM(A1:A5)', {
        workbook: wb,
        cell: { sheetName: 'Sheet1', row: 5, col: 0 },
      })
      expect(result.ok).toBe(true)
      expect(result.value).toBe(15)
    })

    it('IF false branch returns correct string', () => {
      const wb: FormulaWorkbook = {
        sheets: { Sheet1: [[1]] },
        activeSheetName: 'Sheet1',
      }
      const result = adapter.evaluateFormula('=IF(A1>10,"Big","Small")', {
        workbook: wb,
        cell: { sheetName: 'Sheet1', row: 1, col: 0 },
      })
      expect(result.ok).toBe(true)
      expect(result.value).toBe('Small')
    })

    it('VLOOKUP finds exact match in a lookup table', () => {
      // A1:B3 lookup table; we look up "Banana" → 2
      const wb: FormulaWorkbook = {
        sheets: {
          Sheet1: [
            ['Apple',  1],
            ['Banana', 2],
            ['Cherry', 3],
          ],
        },
        activeSheetName: 'Sheet1',
      }
      const result = adapter.evaluateFormula('=VLOOKUP("Banana",A1:B3,2,0)', {
        workbook: wb,
        cell: { sheetName: 'Sheet1', row: 3, col: 0 },
      })
      expect(result.ok).toBe(true)
      expect(result.value).toBe(2)
    })

    it('VLOOKUP returns error for missing value', () => {
      const wb: FormulaWorkbook = {
        sheets: {
          Sheet1: [
            ['Apple',  1],
            ['Banana', 2],
          ],
        },
        activeSheetName: 'Sheet1',
      }
      const result = adapter.evaluateFormula('=VLOOKUP("Mango",A1:B2,2,0)', {
        workbook: wb,
        cell: { sheetName: 'Sheet1', row: 2, col: 0 },
      })
      // HyperFormula returns an error object for #N/A
      expect(result.ok).toBe(false)
    })

    it('nested IF + SUM combination', () => {
      const wb: FormulaWorkbook = {
        sheets: { Sheet1: [[10, 20, 30]] },
        activeSheetName: 'Sheet1',
      }
      // SUM(A1:C1) = 60 > 50, so returns "Yes"
      const result = adapter.evaluateFormula('=IF(SUM(A1:C1)>50,"Yes","No")', {
        workbook: wb,
        cell: { sheetName: 'Sheet1', row: 1, col: 0 },
      })
      expect(result.ok).toBe(true)
      expect(result.value).toBe('Yes')
    })
  })

  // ── (b) Singleton reuse across N calls ───────────────────────────────────

  describe('singleton instance reuse', () => {
    it('HyperFormula.buildFromSheets is NOT called during evaluateFormula calls', () => {
      // Spy on buildFromSheets — it must never be called now that we use the singleton
      const spy = vi.spyOn(HyperFormula, 'buildFromSheets')

      const wb: FormulaWorkbook = {
        sheets: { Sheet1: [[1, 2, 3]] },
        activeSheetName: 'Sheet1',
      }
      const ctx = { workbook: wb, cell: { sheetName: 'Sheet1', row: 1, col: 0 } }

      adapter.evaluateFormula('=SUM(A1:C1)', ctx)
      adapter.evaluateFormula('=SUM(A1:C1)', ctx)
      adapter.evaluateFormula('=SUM(A1:C1)', ctx)

      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('buildFromSheets is never called across getDependencies calls', () => {
      const spy = vi.spyOn(HyperFormula, 'buildFromSheets')

      const wb: FormulaWorkbook = {
        sheets: { Sheet1: [['=A2+A3', null, null], [1], [2]] },
        activeSheetName: 'Sheet1',
      }

      adapter.getDependencies({ sheetName: 'Sheet1', row: 0, col: 0 }, wb)
      adapter.getDependencies({ sheetName: 'Sheet1', row: 0, col: 0 }, wb)

      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('buildFromSheets is never called during recalculateWorkbook', () => {
      const spy = vi.spyOn(HyperFormula, 'buildFromSheets')

      const wb: FormulaWorkbook = {
        sheets: { Sheet1: [[1, 2, '=A1+B1']] },
        activeSheetName: 'Sheet1',
      }

      adapter.recalculateWorkbook(wb)
      adapter.recalculateWorkbook(wb)

      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('produces correct results across consecutive evaluateFormula calls on different workbooks', () => {
      const wb1: FormulaWorkbook = {
        sheets: { Sheet1: [[5, 5]] },
        activeSheetName: 'Sheet1',
      }
      const wb2: FormulaWorkbook = {
        sheets: { Sheet1: [[100, 200]] },
        activeSheetName: 'Sheet1',
      }

      const r1 = adapter.evaluateFormula('=SUM(A1:B1)', {
        workbook: wb1,
        cell: { sheetName: 'Sheet1', row: 1, col: 0 },
      })
      const r2 = adapter.evaluateFormula('=SUM(A1:B1)', {
        workbook: wb2,
        cell: { sheetName: 'Sheet1', row: 1, col: 0 },
      })

      expect(r1.ok).toBe(true)
      expect(r1.value).toBe(10)   // 5 + 5
      expect(r2.ok).toBe(true)
      expect(r2.value).toBe(300)  // 100 + 200
    })
  })
})
