/**
 * Unit tests for the JSON-URL connector — JSONPath resolution and row flattening.
 *
 * Tests the pure `resolvePath` function and the internal flattening logic
 * without making real network requests.
 */

import { describe, it, expect } from 'vitest'
import { resolvePath } from '@/features/connectors/connectors/jsonUrl'

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------

describe('resolvePath', () => {
  it('returns the root object when path is empty string', () => {
    const obj = { a: 1 }
    expect(resolvePath(obj, '')).toBe(obj)
  })

  it('returns the root object when path is undefined', () => {
    const arr = [1, 2, 3]
    expect(resolvePath(arr, undefined)).toBe(arr)
  })

  it('resolves a top-level key', () => {
    expect(resolvePath({ data: [1, 2] }, 'data')).toEqual([1, 2])
  })

  it('resolves a nested dot-notation path', () => {
    const obj = { response: { result: { items: ['a', 'b'] } } }
    expect(resolvePath(obj, 'response.result.items')).toEqual(['a', 'b'])
  })

  it('returns undefined for a missing key', () => {
    expect(resolvePath({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns undefined when an intermediate key is null', () => {
    expect(resolvePath({ a: null }, 'a.b')).toBeUndefined()
  })

  it('returns undefined when an intermediate segment is not an object', () => {
    expect(resolvePath({ a: 42 }, 'a.b')).toBeUndefined()
  })

  it('handles path with leading/trailing spaces', () => {
    expect(resolvePath({ items: [1, 2] }, ' items ')).toEqual([1, 2])
  })

  it('returns primitive values directly', () => {
    expect(resolvePath({ count: 99 }, 'count')).toBe(99)
  })

  it('resolves an array at root by returning it unchanged', () => {
    const arr = [{ id: 1 }, { id: 2 }]
    expect(resolvePath(arr, undefined)).toBe(arr)
  })
})

// ---------------------------------------------------------------------------
// Column derivation helpers (re-implemented to test in isolation)
// ---------------------------------------------------------------------------

function deriveColumns(firstItem: unknown): string[] {
  if (Array.isArray(firstItem)) {
    return Array.from({ length: firstItem.length }, (_, i) => `Col${i + 1}`)
  }
  if (typeof firstItem === 'object' && firstItem !== null) {
    return Object.keys(firstItem)
  }
  return ['value']
}

describe('deriveColumns', () => {
  it('returns object keys for an object item', () => {
    expect(deriveColumns({ id: 1, name: 'Alice', score: 99 })).toEqual([
      'id',
      'name',
      'score',
    ])
  })

  it('returns Col1, Col2, … for an array item', () => {
    expect(deriveColumns([1, 2, 3])).toEqual(['Col1', 'Col2', 'Col3'])
  })

  it('returns ["value"] for a scalar', () => {
    expect(deriveColumns('hello')).toEqual(['value'])
  })

  it('returns ["value"] for a number', () => {
    expect(deriveColumns(42)).toEqual(['value'])
  })
})

// ---------------------------------------------------------------------------
// Flatten / row-extraction simulation
// ---------------------------------------------------------------------------

import type { CellValue } from '@/features/connectors/types'

function flattenRecord(record: unknown, columns: string[]): CellValue[] {
  if (Array.isArray(record)) {
    return columns.map((_, idx) => {
      const v = record[idx]
      return v === undefined || v === null ? null : (v as CellValue)
    })
  }
  if (typeof record === 'object' && record !== null) {
    return columns.map((col) => {
      const v = (record as Record<string, unknown>)[col]
      if (v === undefined || v === null) return null
      if (typeof v === 'object') return JSON.stringify(v)
      return v as CellValue
    })
  }
  return [record as CellValue]
}

describe('flattenRecord', () => {
  const cols = ['id', 'name', 'score']

  it('extracts fields from an object by column name', () => {
    expect(flattenRecord({ id: 1, name: 'Alice', score: 99 }, cols)).toEqual([1, 'Alice', 99])
  })

  it('returns null for missing fields', () => {
    expect(flattenRecord({ id: 1, name: 'Bob' }, cols)).toEqual([1, 'Bob', null])
  })

  it('stringifies nested objects', () => {
    const result = flattenRecord({ id: 1, name: 'X', score: { raw: 5 } }, cols)
    expect(result[2]).toBe('{"raw":5}')
  })

  it('extracts array items by index', () => {
    expect(flattenRecord([10, 'ten', true], ['Col1', 'Col2', 'Col3'])).toEqual([10, 'ten', true])
  })

  it('wraps a scalar in a single-element array', () => {
    expect(flattenRecord('hello', ['value'])).toEqual(['hello'])
  })
})

// ---------------------------------------------------------------------------
// Integration: resolve + flatten simulation
// ---------------------------------------------------------------------------

describe('full JSON parse simulation', () => {
  const sampleResponse = {
    meta: { total: 3 },
    data: {
      users: [
        { id: 1, name: 'Alice', active: true },
        { id: 2, name: 'Bob', active: false },
        { id: 3, name: 'Charlie', active: true },
      ],
    },
  }

  it('resolves nested path and flattens all rows', () => {
    const resolved = resolvePath(sampleResponse, 'data.users')
    expect(Array.isArray(resolved)).toBe(true)
    const arr = resolved as unknown[]
    const columns = deriveColumns(arr[0])
    expect(columns).toEqual(['id', 'name', 'active'])

    const rows = arr.map((item) => flattenRecord(item, columns))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual([1, 'Alice', true])
    expect(rows[1]).toEqual([2, 'Bob', false])
    expect(rows[2]).toEqual([3, 'Charlie', true])
  })

  it('handles root-level array with no path', () => {
    const rootArr = [{ a: 1 }, { a: 2 }]
    const resolved = resolvePath(rootArr, undefined)
    expect(Array.isArray(resolved)).toBe(true)
    const arr = resolved as unknown[]
    const columns = deriveColumns(arr[0])
    expect(columns).toEqual(['a'])
    expect(flattenRecord(arr[0], columns)).toEqual([1])
  })
})
