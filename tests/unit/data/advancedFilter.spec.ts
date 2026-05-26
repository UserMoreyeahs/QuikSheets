import { describe, it, expect } from 'vitest'
import {
  evaluateCriterion,
  parseA1Range,
  formatA1Range,
  evaluateAdvancedFilter,
} from '@/features/data/utils/advancedFilter'

describe('parseA1Range', () => {
  it('parses a full range A1:E15', () => {
    expect(parseA1Range('A1:E15')).toEqual({
      startRow: 0,
      endRow: 14,
      startCol: 0,
      endCol: 4,
    })
  })

  it('parses a single cell as a 1x1 range', () => {
    expect(parseA1Range('B2')).toEqual({
      startRow: 1,
      endRow: 1,
      startCol: 1,
      endCol: 1,
    })
  })

  it('normalises reversed corners (E15:A1 ⇒ A1:E15)', () => {
    expect(parseA1Range('E15:A1')).toEqual({
      startRow: 0,
      endRow: 14,
      startCol: 0,
      endCol: 4,
    })
  })

  it('strips absolute-reference dollar signs', () => {
    expect(parseA1Range('$A$1:$B$2')).toEqual({
      startRow: 0,
      endRow: 1,
      startCol: 0,
      endCol: 1,
    })
  })

  it('throws on empty input', () => {
    expect(() => parseA1Range('')).toThrow()
  })
})

describe('formatA1Range', () => {
  it('formats a multi-cell range', () => {
    expect(formatA1Range({ startRow: 0, endRow: 14, startCol: 0, endCol: 4 })).toBe('A1:E15')
  })

  it('formats a 1x1 range as a single cell', () => {
    expect(formatA1Range({ startRow: 1, endRow: 1, startCol: 1, endCol: 1 })).toBe('B2')
  })
})

describe('evaluateCriterion', () => {
  it('empty criterion matches anything', () => {
    expect(evaluateCriterion('', 'foo')).toBe(true)
    expect(evaluateCriterion(null, 42)).toBe(true)
  })

  it('plain value does case-insensitive exact match', () => {
    expect(evaluateCriterion('West', 'west')).toBe(true)
    expect(evaluateCriterion('West', 'East')).toBe(false)
  })

  it('=value does exact match', () => {
    expect(evaluateCriterion('=Active', 'Active')).toBe(true)
    expect(evaluateCriterion('=Active', 'Inactive')).toBe(false)
  })

  it('>n compares numerically', () => {
    expect(evaluateCriterion('>100', 150)).toBe(true)
    expect(evaluateCriterion('>100', 100)).toBe(false)
    expect(evaluateCriterion('>100', 50)).toBe(false)
  })

  it('>=n includes equality', () => {
    expect(evaluateCriterion('>=100', 100)).toBe(true)
    expect(evaluateCriterion('>=100', 99)).toBe(false)
  })

  it('<n and <=n', () => {
    expect(evaluateCriterion('<50', 30)).toBe(true)
    expect(evaluateCriterion('<50', 50)).toBe(false)
    expect(evaluateCriterion('<=50', 50)).toBe(true)
  })

  it('<>value is not-equal', () => {
    expect(evaluateCriterion('<>West', 'East')).toBe(true)
    expect(evaluateCriterion('<>West', 'West')).toBe(false)
  })

  it('numeric comparators against non-numeric cell return false', () => {
    expect(evaluateCriterion('>100', 'not a number')).toBe(false)
  })

  it('wildcard value* matches starts-with', () => {
    expect(evaluateCriterion('Acme*', 'Acme Corp')).toBe(true)
    expect(evaluateCriterion('Acme*', 'Other')).toBe(false)
  })

  it('wildcard *value matches ends-with', () => {
    expect(evaluateCriterion('*Corp', 'Acme Corp')).toBe(true)
    expect(evaluateCriterion('*Corp', 'Acme')).toBe(false)
  })

  it('wildcard *value* matches contains', () => {
    expect(evaluateCriterion('*me C*', 'Acme Corp')).toBe(true)
  })
})

describe('evaluateAdvancedFilter — AND/OR semantics', () => {
  // Mini fixture: 5 columns × 6 rows. Row 0 = headers, rows 1-5 = data.
  // Columns:  A=Region, B=Sales, C=Owner, D=Status, E=City
  const matrix: (string | number | null)[][] = [
    ['Region', 'Sales', 'Owner', 'Status', 'City'],         // row 0
    ['West',   120,     'Alice', 'Active', 'Seattle'],      // row 1
    ['West',    80,     'Bob',   'Active', 'Portland'],     // row 2
    ['East',   250,     'Carol', 'Active', 'Boston'],       // row 3
    ['East',   150,     'Dan',   'Closed', 'New York'],     // row 4
    ['North',  300,     'Eve',   'Active', 'Chicago'],      // row 5
  ]

  it('single-row criteria does AND (Region=West AND Sales>100)', () => {
    // Criteria at row 7:8 (header + 1 condition) — values irrelevant here.
    // We supply the criteria via a synthetic matrix slice instead.
    const m: (string | number | null)[][] = [
      ...matrix,
      [], // row 6 spacer
      ['Region', 'Sales', null, null, null], // row 7 — criteria header
      ['West',   '>100',  null, null, null], // row 8 — condition
    ]
    const result = evaluateAdvancedFilter(m, {
      listRange: 'A1:E6',
      criteriaRange: 'A8:B9',
    })
    // Only row 1 (West, 120) matches; rows 2-5 hidden.
    expect(result.hiddenRows).toEqual([2, 3, 4, 5])
    expect(result.matchedRowCount).toBe(1)
    expect(result.totalDataRows).toBe(5)
  })

  it('multi-row criteria does OR across rows (the example from the spec)', () => {
    // (Region=West AND Sales>100) OR (Region=East AND Sales>200)
    const m: (string | number | null)[][] = [
      ...matrix,
      [],
      ['Region', 'Sales', null, null, null],
      ['West',   '>100',  null, null, null],
      ['East',   '>200',  null, null, null],
    ]
    const result = evaluateAdvancedFilter(m, {
      listRange: 'A1:E6',
      criteriaRange: 'A8:B10',
    })
    // Row 1: West/120 ✓, Row 2: West/80 ✗, Row 3: East/250 ✓, Row 4: East/150 ✗, Row 5: North ✗
    expect(result.matchedRowCount).toBe(2)
    expect(result.hiddenRows).toEqual([2, 4, 5])
  })

  it('empty cell in a criterion row means "any value in this column"', () => {
    // Status=Active with no Region constraint
    const m: (string | number | null)[][] = [
      ...matrix,
      [],
      ['Region', 'Status', null, null, null],
      [null,     'Active', null, null, null],
    ]
    const result = evaluateAdvancedFilter(m, {
      listRange: 'A1:E6',
      criteriaRange: 'A8:B9',
    })
    // Rows with Status=Active: 1, 2, 3, 5 — row 4 (Closed) is hidden.
    expect(result.hiddenRows).toEqual([4])
    expect(result.matchedRowCount).toBe(4)
  })

  it('criteria header that does not match any list header is ignored', () => {
    const m: (string | number | null)[][] = [
      ...matrix,
      [],
      ['NotAColumn', 'Sales', null, null, null],
      ['anything',   '>=150', null, null, null],
    ]
    const result = evaluateAdvancedFilter(m, {
      listRange: 'A1:E6',
      criteriaRange: 'A8:B9',
    })
    // The bogus header gets dropped; only Sales>=150 applies.
    // Rows passing: 3 (250), 4 (150), 5 (300) → hide rows 1, 2
    expect(result.matchedRowCount).toBe(3)
    expect(result.hiddenRows).toEqual([1, 2])
  })

  it('wildcard criterion filters by prefix (City=B*)', () => {
    const m: (string | number | null)[][] = [
      ...matrix,
      [],
      ['City', null, null, null, null],
      ['B*',   null, null, null, null],
    ]
    const result = evaluateAdvancedFilter(m, {
      listRange: 'A1:E6',
      criteriaRange: 'A8:A9',
    })
    // Boston (row 3) is the only City starting with B.
    expect(result.matchedRowCount).toBe(1)
    expect(result.hiddenRows).toEqual([1, 2, 4, 5])
  })

  it('all-empty criterion rows are skipped, not treated as match-all', () => {
    const m: (string | number | null)[][] = [
      ...matrix,
      [],
      ['Region', 'Sales', null, null, null],
      ['West',   null,    null, null, null],
      [null,     null,    null, null, null], // wholly empty — must be ignored
    ]
    const result = evaluateAdvancedFilter(m, {
      listRange: 'A1:E6',
      criteriaRange: 'A8:B10',
    })
    // Only the West condition counts. West matches rows 1 & 2.
    expect(result.matchedRowCount).toBe(2)
    expect(result.hiddenRows).toEqual([3, 4, 5])
  })

  it('throws when list range has no data rows', () => {
    expect(() =>
      evaluateAdvancedFilter(matrix, { listRange: 'A1', criteriaRange: 'A8:B9' })
    ).toThrow(/list range/i)
  })

  it('throws when criteria range has no condition rows', () => {
    expect(() =>
      evaluateAdvancedFilter(matrix, { listRange: 'A1:E6', criteriaRange: 'A8' })
    ).toThrow(/criteria range/i)
  })
})
