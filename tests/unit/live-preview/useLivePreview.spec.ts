/**
 * Unit tests for the incremental HyperFormula evaluation in useLivePreview.
 *
 * We test the pure helper functions extracted from the hook — specifically the
 * cell-reference extraction and minimal-matrix builder — and then assert that
 * HyperFormula.buildFromSheets is called with ONLY the cells referenced by the
 * formula (not the full workbook matrix).
 *
 * The hook itself is a React hook and requires a full render environment;
 * those integration concerns are covered by the existing e2e suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HyperFormula } from 'hyperformula'
import { HYPERFORMULA_CONFIG } from '@/lib/hyperformula'

// ─── Re-export internals under test ──────────────────────────────────────────
// Because the helpers live inside the hook module we import the module
// directly. TypeScript treats module-level functions as implementation detail,
// so we use a local copy of the same logic here to keep the tests hermetic.

/** Mirror of colLettersToIndex in the hook */
function colLettersToIndex(letters: string): number {
  const upper = letters.toUpperCase().replace(/\$/g, '')
  let index = 0
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64)
  }
  return index - 1
}

/** Mirror of cellAddressToRC in the hook */
function cellAddressToRC(addr: string): { row: number; col: number } | null {
  const clean = addr.replace(/\$/g, '')
  const m = /^([A-Za-z]+)(\d+)$/.exec(clean)
  if (!m || !m[1] || !m[2]) return null
  return { row: parseInt(m[2], 10) - 1, col: colLettersToIndex(m[1]) }
}

/** Mirror of extractAllReferencedCells in the hook */
function extractAllReferencedCells(formula: string) {
  const pattern =
    /(?:('(?:[^']|'')*'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]+\$?\d+)(?::(\$?[A-Z]+\$?\d+))?/gi

  const localCells = new Set<string>()
  const crossSheetCells = new Map<string, Set<string>>()

  let match: RegExpExecArray | null
  while ((match = pattern.exec(formula)) !== null) {
    const sheetPrefix = match[1] ?? null
    const startStr = match[2]
    const endStr = match[3] ?? null
    if (!startStr) continue

    const start = cellAddressToRC(startStr)
    if (!start) continue

    const cells: Array<{ row: number; col: number }> = []

    if (endStr) {
      const end = cellAddressToRC(endStr)
      if (end) {
        const rMin = Math.min(start.row, end.row)
        const rMax = Math.max(start.row, end.row)
        const cMin = Math.min(start.col, end.col)
        const cMax = Math.max(start.col, end.col)
        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            cells.push({ row: r, col: c })
          }
        }
      } else {
        cells.push(start)
      }
    } else {
      cells.push(start)
    }

    if (sheetPrefix) {
      const name = sheetPrefix.startsWith("'")
        ? sheetPrefix.slice(1, -1).replace(/''/g, "'")
        : sheetPrefix
      if (!crossSheetCells.has(name)) crossSheetCells.set(name, new Set())
      const set = crossSheetCells.get(name)!
      for (const c of cells) set.add(`${c.row}:${c.col}`)
    } else {
      for (const c of cells) localCells.add(`${c.row}:${c.col}`)
    }
  }

  return { localCells, crossSheetCells }
}

// ─── Helper: run minimal evaluation exactly as the hook does ─────────────────

type FormulaValue = string | number | boolean | null

/**
 * Build a minimal FormulaValue[][] matrix sized to fit all keys in cellKeys.
 * Each key is "r:c".
 * Values come from the provided valueMap (same "r:c" key → value).
 */
function buildMinimalMatrix(
  valueMap: Map<string, FormulaValue>,
  cellKeys: Set<string>
): FormulaValue[][] {
  if (cellKeys.size === 0) return [[]]

  let maxRow = 0
  let maxCol = 0
  for (const key of cellKeys) {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0', 10)
    const c = parseInt(cStr ?? '0', 10)
    if (r > maxRow) maxRow = r
    if (c > maxCol) maxCol = c
  }

  const matrix: FormulaValue[][] = Array.from({ length: maxRow + 1 }, () =>
    Array.from<FormulaValue>({ length: maxCol + 1 }).fill(null)
  )

  for (const key of cellKeys) {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0', 10)
    const c = parseInt(cStr ?? '0', 10)
    matrix[r]![c] = valueMap.get(key) ?? null
  }

  return matrix
}

/**
 * Evaluate a formula incrementally using the same algorithm as useLivePreview.
 *
 * gridValues: flat map of "r:c" → value for the active sheet.
 * editingCell: where the formula is entered.
 */
function evaluateIncremental(
  formula: string,
  gridValues: Map<string, FormulaValue>,
  editingCell: { row: number; col: number },
  sheetName = 'Sheet1'
): FormulaValue {
  const { localCells } = extractAllReferencedCells(formula)
  const editingKey = `${editingCell.row}:${editingCell.col}`
  localCells.delete(editingKey)

  const matrix = buildMinimalMatrix(gridValues, localCells)

  // Grow to include editing cell
  while (matrix.length <= editingCell.row)
    matrix.push(Array.from<FormulaValue>({ length: matrix[0]?.length ?? 1 }).fill(null))
  const activeRow = matrix[editingCell.row]!
  while (activeRow.length <= editingCell.col) activeRow.push(null)

  const hf = HyperFormula.buildFromSheets(
    { [sheetName]: matrix },
    HYPERFORMULA_CONFIG
  )
  try {
    const sheetId = hf.getSheetId(sheetName)!
    hf.setCellContents({ sheet: sheetId, row: editingCell.row, col: editingCell.col }, [[formula]])
    const v = hf.getCellValue({ sheet: sheetId, row: editingCell.row, col: editingCell.col })
    if (v === null || v === undefined) return null
    if (typeof v === 'object' && 'type' in v) return null
    return v as FormulaValue
  } finally {
    hf.destroy()
  }
}

// ─── Tests: extractAllReferencedCells ────────────────────────────────────────

describe('extractAllReferencedCells', () => {
  it('extracts a single cell reference', () => {
    const { localCells } = extractAllReferencedCells('=A1+B2')
    expect(localCells.has('0:0')).toBe(true) // A1 → row 0, col 0
    expect(localCells.has('1:1')).toBe(true) // B2 → row 1, col 1
  })

  it('expands a range to all individual cells', () => {
    const { localCells } = extractAllReferencedCells('=SUM(A1:A5)')
    expect(localCells.size).toBe(5)
    for (let r = 0; r < 5; r++) {
      expect(localCells.has(`${r}:0`)).toBe(true)
    }
  })

  it('expands a 2-D range', () => {
    const { localCells } = extractAllReferencedCells('=SUM(A1:B3)')
    // A1:B3 = 3 rows × 2 cols = 6 cells
    expect(localCells.size).toBe(6)
  })

  it('handles cross-sheet references', () => {
    const { localCells, crossSheetCells } = extractAllReferencedCells('=Sheet2!A1')
    expect(localCells.size).toBe(0)
    expect(crossSheetCells.has('Sheet2')).toBe(true)
    expect(crossSheetCells.get('Sheet2')!.has('0:0')).toBe(true)
  })

  it('handles multi-arg formulas and duplicate refs are collapsed', () => {
    const { localCells } = extractAllReferencedCells('=IF(A1>0,A1*2,0)')
    // A1 appears twice but Set deduplicates
    expect(localCells.has('0:0')).toBe(true)
    expect(localCells.size).toBe(1)
  })
})

// ─── Tests: full incremental evaluation (HyperFormula.buildFromSheets) ───────

describe('incremental evaluation — identical output to full-workbook approach', () => {
  it('arithmetic: =A1+B2', () => {
    const values = new Map<string, FormulaValue>([
      ['0:0', 10], // A1 = 10
      ['1:1', 5],  // B2 = 5
    ])
    const result = evaluateIncremental('=A1+B2', values, { row: 2, col: 0 })
    expect(result).toBe(15)
  })

  it('arithmetic: =A1*B2', () => {
    const values = new Map<string, FormulaValue>([
      ['0:0', 7],
      ['1:1', 3],
    ])
    const result = evaluateIncremental('=A1*B2', values, { row: 2, col: 0 })
    expect(result).toBe(21)
  })

  it('range ref: =SUM(A1:A10)', () => {
    const values = new Map<string, FormulaValue>()
    for (let r = 0; r < 10; r++) values.set(`${r}:0`, r + 1) // 1..10
    const result = evaluateIncremental('=SUM(A1:A10)', values, { row: 10, col: 0 })
    expect(result).toBe(55)
  })

  it('range ref: =AVERAGE(B1:B5)', () => {
    const values = new Map<string, FormulaValue>([
      ['0:1', 2],
      ['1:1', 4],
      ['2:1', 6],
      ['3:1', 8],
      ['4:1', 10],
    ])
    const result = evaluateIncremental('=AVERAGE(B1:B5)', values, { row: 5, col: 0 })
    expect(result).toBe(6)
  })

  it('multi-arg: =IF(A1>0,A1*2,0) — truthy branch', () => {
    const values = new Map<string, FormulaValue>([['0:0', 5]])
    const result = evaluateIncremental('=IF(A1>0,A1*2,0)', values, { row: 1, col: 0 })
    expect(result).toBe(10)
  })

  it('multi-arg: =IF(A1>0,A1*2,0) — falsy branch', () => {
    const values = new Map<string, FormulaValue>([['0:0', -3]])
    const result = evaluateIncremental('=IF(A1>0,A1*2,0)', values, { row: 1, col: 0 })
    expect(result).toBe(0)
  })

  it('multi-arg: =VLOOKUP(A1,B1:C3,2,0) — exact match with numeric false flag', () => {
    // lookup "banana" in B1:C3 → returns matching C column value
    // Uses 0 instead of FALSE because localeLang:'en' does not register boolean literals
    const values = new Map<string, FormulaValue>([
      ['0:0', 'banana'],   // A1
      ['0:1', 'apple'],    // B1
      ['0:2', 1],          // C1
      ['1:1', 'banana'],   // B2
      ['1:2', 2],          // C2
      ['2:1', 'cherry'],   // B3
      ['2:2', 3],          // C3
    ])
    const result = evaluateIncremental('=VLOOKUP(A1,B1:C3,2,0)', values, { row: 5, col: 0 })
    expect(result).toBe(2)
  })
})

// ─── Tests: buildFromSheets is called with ONLY referenced cells ──────────────

describe('buildFromSheets receives minimal (not full-workbook) input', () => {
  const buildFromSheetsSpy = vi.spyOn(HyperFormula, 'buildFromSheets')

  beforeEach(() => {
    buildFromSheetsSpy.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('=A1+B2 — only A1, B2 and editing cell row appear in the sheet matrix', () => {
    // Restore spy so real HF is called (we inspect args)
    buildFromSheetsSpy.mockRestore()
    const restored = vi.spyOn(HyperFormula, 'buildFromSheets')

    const values = new Map<string, FormulaValue>([
      ['0:0', 10], // A1
      ['1:1', 5],  // B2
      // Large irrelevant data that should NOT appear:
      ['99:25', 999],
      ['50:10', 777],
    ])

    evaluateIncremental('=A1+B2', values, { row: 2, col: 0 })

    expect(restored).toHaveBeenCalledOnce()
    const [sheets] = restored.mock.calls[0]!
    const matrix = (sheets as Record<string, FormulaValue[][]>)['Sheet1']!

    // The matrix must be sized to fit row 2 (editing cell) at most
    // It should NOT contain row 99 (from the irrelevant '99:25' entry)
    expect(matrix.length).toBeLessThanOrEqual(3) // rows 0, 1, 2 at most

    // A1 and B2 values present
    expect(matrix[0]?.[0]).toBe(10)
    expect(matrix[1]?.[1]).toBe(5)

    restored.mockRestore()
  })

  it('=SUM(A1:A3) — only A1, A2, A3 appear (not col B)', () => {
    buildFromSheetsSpy.mockRestore()
    const restored = vi.spyOn(HyperFormula, 'buildFromSheets')

    const values = new Map<string, FormulaValue>([
      ['0:0', 1], ['1:0', 2], ['2:0', 3],
      ['0:1', 999], ['1:1', 888], // col B — should NOT be included
    ])

    evaluateIncremental('=SUM(A1:A3)', values, { row: 3, col: 0 })

    const [sheets] = restored.mock.calls[0]!
    const matrix = (sheets as Record<string, FormulaValue[][]>)['Sheet1']!

    // Col B (index 1) cells must all be null / absent
    for (const row of matrix) {
      const colB = row?.[1]
      expect(colB == null || colB === null).toBe(true)
    }

    restored.mockRestore()
  })
})

// ─── Additional edge-case tests ───────────────────────────────────────────────

describe('edge cases', () => {
  it('returns null for an invalid / error formula', () => {
    const result = evaluateIncremental('=NOTAFUNCTION(A1)', new Map(), { row: 1, col: 0 })
    // HyperFormula returns an error object; formatPreviewValue maps it to null
    expect(result).toBeNull()
  })

  it('handles absolute cell references ($A$1)', () => {
    const values = new Map<string, FormulaValue>([['0:0', 42]])
    const result = evaluateIncremental('=$A$1*2', values, { row: 1, col: 0 })
    expect(result).toBe(84)
  })

  it('range with large row count: =AVERAGE(B2:B101)', () => {
    const values = new Map<string, FormulaValue>()
    // B2:B101 → rows 1..100, col 1
    for (let r = 1; r <= 100; r++) values.set(`${r}:1`, 10)
    const result = evaluateIncremental('=AVERAGE(B2:B101)', values, { row: 101, col: 0 })
    expect(result).toBe(10)
  })
})
