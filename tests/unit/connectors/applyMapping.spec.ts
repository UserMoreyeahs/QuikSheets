/**
 * Unit tests for applyMapping and buildDefaultMapping.
 *
 * Verifies that fetched rows are correctly transformed and placed into
 * the right sheet cells (r, c) with the right values and display strings.
 */

import { describe, it, expect } from 'vitest'
import { applyMapping, buildDefaultMapping } from '@/features/connectors/utils/applyMapping'
import type { FetchResult, ColumnMapping } from '@/features/connectors/types'

// ---------------------------------------------------------------------------
// Shared test fixture
// ---------------------------------------------------------------------------

const sampleResult: FetchResult = {
  columns: ['Name', 'Revenue', 'Active'],
  columnTypes: ['string', 'number', 'boolean'],
  rows: [
    ['Alice', 85000, true],
    ['Bob', 72000, false],
  ],
  rowCount: 2,
}

const identityMapping: ColumnMapping[] = [
  { sourceField: 'Name', targetColumn: 0 },
  { sourceField: 'Revenue', targetColumn: 1 },
  { sourceField: 'Active', targetColumn: 2 },
]

// ---------------------------------------------------------------------------
// buildDefaultMapping
// ---------------------------------------------------------------------------

describe('buildDefaultMapping', () => {
  it('maps every column to its own 0-based index', () => {
    const mapping = buildDefaultMapping(['A', 'B', 'C'])
    expect(mapping).toEqual([
      { sourceField: 'A', targetColumn: 0 },
      { sourceField: 'B', targetColumn: 1 },
      { sourceField: 'C', targetColumn: 2 },
    ])
  })

  it('returns empty array for empty columns', () => {
    expect(buildDefaultMapping([])).toEqual([])
  })

  it('does not set a transform (auto mode)', () => {
    const mapping = buildDefaultMapping(['X'])
    expect(mapping[0]?.transform).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// applyMapping — header row
// ---------------------------------------------------------------------------

describe('applyMapping — header row', () => {
  it('writes header at startRow when includeHeader is true', () => {
    const cells = applyMapping(sampleResult, identityMapping, 0, true)
    const headerCells = cells.filter((c) => c.r === 0)
    expect(headerCells).toHaveLength(3)
    expect(headerCells.find((c) => c.c === 0)?.v.v).toBe('Name')
    expect(headerCells.find((c) => c.c === 1)?.v.v).toBe('Revenue')
    expect(headerCells.find((c) => c.c === 2)?.v.v).toBe('Active')
  })

  it('does NOT write a header row when includeHeader is false', () => {
    const cells = applyMapping(sampleResult, identityMapping, 0, false)
    // Data rows start at row 0, so no separate header cell should contain 'Name'
    // unless it happens to be a data value
    const nameCells = cells.filter((c) => c.v.v === 'Name')
    expect(nameCells).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// applyMapping — data rows
// ---------------------------------------------------------------------------

describe('applyMapping — data rows', () => {
  it('writes data starting at row 1 (after header)', () => {
    const cells = applyMapping(sampleResult, identityMapping, 0, true)
    const row1 = cells.filter((c) => c.r === 1)
    expect(row1).toHaveLength(3)
    expect(row1.find((c) => c.c === 0)?.v.v).toBe('Alice')
    expect(row1.find((c) => c.c === 1)?.v.v).toBe(85000)
    expect(row1.find((c) => c.c === 2)?.v.v).toBe(true)
  })

  it('writes data starting at row 0 when includeHeader is false', () => {
    const cells = applyMapping(sampleResult, identityMapping, 0, false)
    const row0 = cells.filter((c) => c.r === 0)
    expect(row0.find((c) => c.c === 0)?.v.v).toBe('Alice')
  })

  it('respects a non-zero startRow offset', () => {
    const cells = applyMapping(sampleResult, identityMapping, 5, true)
    // Header at row 5, first data row at row 6
    expect(cells.filter((c) => c.r === 5)).toHaveLength(3)
    expect(cells.filter((c) => c.r === 6).find((c) => c.c === 0)?.v.v).toBe('Alice')
    expect(cells.filter((c) => c.r === 7).find((c) => c.c === 0)?.v.v).toBe('Bob')
  })
})

// ---------------------------------------------------------------------------
// applyMapping — target column remapping
// ---------------------------------------------------------------------------

describe('applyMapping — target column remapping', () => {
  it('writes to remapped target columns', () => {
    const mapping: ColumnMapping[] = [
      { sourceField: 'Name', targetColumn: 2 },
      { sourceField: 'Revenue', targetColumn: 4 },
    ]
    const cells = applyMapping(sampleResult, mapping, 0, false)
    const row0 = cells.filter((c) => c.r === 0)
    expect(row0.find((c) => c.c === 2)?.v.v).toBe('Alice')
    expect(row0.find((c) => c.c === 4)?.v.v).toBe(85000)
    // Active column not in mapping — should not appear
    expect(row0.find((c) => c.c === 0)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// applyMapping — transforms
// ---------------------------------------------------------------------------

describe('applyMapping — transforms', () => {
  it('applies "string" transform — coerces number to string', () => {
    const mapping: ColumnMapping[] = [
      { sourceField: 'Revenue', targetColumn: 0, transform: 'string' },
    ]
    const cells = applyMapping(sampleResult, mapping, 0, false)
    const cell = cells.find((c) => c.r === 0 && c.c === 0)
    expect(cell?.v.v).toBe('85000')
  })

  it('applies "number" transform — converts string to number', () => {
    const strResult: FetchResult = {
      columns: ['Amount'],
      columnTypes: ['string'],
      rows: [['1500.50'], ['3000']],
      rowCount: 2,
    }
    const mapping: ColumnMapping[] = [
      { sourceField: 'Amount', targetColumn: 0, transform: 'number' },
    ]
    const cells = applyMapping(strResult, mapping, 0, false)
    expect(cells.find((c) => c.r === 0)?.v.v).toBe(1500.5)
    expect(cells.find((c) => c.r === 1)?.v.v).toBe(3000)
  })

  it('returns null for "number" transform on non-numeric string', () => {
    const strResult: FetchResult = {
      columns: ['X'],
      columnTypes: ['string'],
      rows: [['not-a-number']],
      rowCount: 1,
    }
    const mapping: ColumnMapping[] = [{ sourceField: 'X', targetColumn: 0, transform: 'number' }]
    const cells = applyMapping(strResult, mapping, 0, false)
    expect(cells[0]?.v.v).toBeNull()
  })

  it('applies "boolean" transform', () => {
    const strResult: FetchResult = {
      columns: ['Flag'],
      columnTypes: ['string'],
      rows: [['yes'], ['no'], ['true'], ['false'], ['1'], ['0']],
      rowCount: 6,
    }
    const mapping: ColumnMapping[] = [{ sourceField: 'Flag', targetColumn: 0, transform: 'boolean' }]
    const cells = applyMapping(strResult, mapping, 0, false)
    const vals = cells.map((c) => c.v.v)
    expect(vals[0]).toBe(true)
    expect(vals[1]).toBe(false)
    expect(vals[2]).toBe(true)
    expect(vals[3]).toBe(false)
    expect(vals[4]).toBe(true)
    expect(vals[5]).toBe(false)
  })

  it('applies "date" transform — returns ISO string for valid dates', () => {
    const strResult: FetchResult = {
      columns: ['CreatedAt'],
      columnTypes: ['date'],
      rows: [['2024-01-15']],
      rowCount: 1,
    }
    const mapping: ColumnMapping[] = [{ sourceField: 'CreatedAt', targetColumn: 0, transform: 'date' }]
    const cells = applyMapping(strResult, mapping, 0, false)
    const val = cells[0]?.v.v
    expect(typeof val).toBe('string')
    expect(String(val)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('keeps original string for "date" transform on invalid date', () => {
    const strResult: FetchResult = {
      columns: ['D'],
      columnTypes: ['string'],
      rows: [['not-a-date']],
      rowCount: 1,
    }
    const mapping: ColumnMapping[] = [{ sourceField: 'D', targetColumn: 0, transform: 'date' }]
    const cells = applyMapping(strResult, mapping, 0, false)
    expect(cells[0]?.v.v).toBe('not-a-date')
  })
})

// ---------------------------------------------------------------------------
// applyMapping — display string (m field)
// ---------------------------------------------------------------------------

describe('applyMapping — display string', () => {
  it('sets m to empty string for null values', () => {
    const nullResult: FetchResult = {
      columns: ['X'],
      columnTypes: ['string'],
      rows: [[null]],
      rowCount: 1,
    }
    const mapping: ColumnMapping[] = [{ sourceField: 'X', targetColumn: 0 }]
    const cells = applyMapping(nullResult, mapping, 0, false)
    expect(cells[0]?.v.m).toBe('')
  })

  it('sets m to "TRUE"/"FALSE" for booleans', () => {
    const boolResult: FetchResult = {
      columns: ['Flag'],
      columnTypes: ['boolean'],
      rows: [[true], [false]],
      rowCount: 2,
    }
    const mapping: ColumnMapping[] = [{ sourceField: 'Flag', targetColumn: 0 }]
    const cells = applyMapping(boolResult, mapping, 0, false)
    expect(cells[0]?.v.m).toBe('TRUE')
    expect(cells[1]?.v.m).toBe('FALSE')
  })

  it('sets m to string representation of numbers', () => {
    const mapping: ColumnMapping[] = [{ sourceField: 'Revenue', targetColumn: 0 }]
    const cells = applyMapping(sampleResult, mapping, 0, false)
    expect(cells[0]?.v.m).toBe('85000')
  })
})

// ---------------------------------------------------------------------------
// applyMapping — missing source field
// ---------------------------------------------------------------------------

describe('applyMapping — missing source field', () => {
  it('skips mappings whose sourceField does not exist in result.columns', () => {
    const mapping: ColumnMapping[] = [
      { sourceField: 'NonExistent', targetColumn: 0 },
      { sourceField: 'Name', targetColumn: 1 },
    ]
    const cells = applyMapping(sampleResult, mapping, 0, false)
    // Only Name cells should appear (NonExistent is skipped)
    const col0 = cells.filter((c) => c.c === 0)
    expect(col0).toHaveLength(0)
    const col1 = cells.filter((c) => c.c === 1)
    expect(col1).toHaveLength(2)
    expect(col1[0]?.v.v).toBe('Alice')
  })
})
