/**
 * createSampleWorkbook structural contract.
 *
 * New workbooks are seeded with this sample so the first-run grid isn't
 * blank. FortuneSheet RENDERS from the 2-D `data` matrix when hydrating
 * via the data prop (see CLAUDE.md "data + celldata must update in
 * lockstep"), so the sheet MUST carry a populated `data` matrix — a
 * celldata-only sheet renders blank. These tests pin that.
 */

import { describe, it, expect } from 'vitest'
import { createSampleWorkbook, createDefaultWorkbook } from '@/lib/defaultSheet'

describe('createSampleWorkbook', () => {
  const [sheet] = createSampleWorkbook()

  it('returns a single active Sheet1', () => {
    expect(sheet).toBeTruthy()
    expect(sheet!.id).toBe('sheet1')
    expect(sheet!.name).toBe('Sheet1')
    expect(sheet!.status).toBe(1)
  })

  it('carries BOTH a populated data matrix and celldata', () => {
    expect(Array.isArray(sheet!.data)).toBe(true)
    expect((sheet!.celldata?.length ?? 0)).toBeGreaterThan(0)
    // data matrix is what FortuneSheet renders — it must hold the values
    const a1 = sheet!.data?.[0]?.[0] as { v?: unknown } | null
    expect(a1?.v).toBe('Product')
  })

  it('header row is the 5 expected columns', () => {
    const headerVals = (sheet!.data?.[0] ?? []).slice(0, 5).map((c) => (c as { v?: unknown } | null)?.v)
    expect(headerVals).toEqual(['Product', 'Region', 'Units', 'Unit Price', 'Revenue'])
  })

  it('formula cells store f WITHOUT a leading "=" and cache v/m so they render on mount', () => {
    // Regression: a leading "=" in `f` is unparseable by FortuneSheet AND
    // doubles to "==" in the formula bar; missing v/m left the cell blank on
    // hydration. Revenue column showed blank on every new workbook.
    const e2 = sheet!.data?.[1]?.[4] as { f?: string; v?: unknown } | null
    expect(e2?.f).toBe('C2*D2')
    expect(e2?.v).toBe(1198.8)
    const e7 = sheet!.data?.[6]?.[4] as { f?: string; v?: unknown } | null
    expect(e7?.f).toBe('SUM(E2:E5)')
    expect(e7?.v).toBe(5169.8)
  })

  it('data and celldata agree on A1', () => {
    const fromData = sheet!.data?.[0]?.[0] as { v?: unknown } | null
    const fromCelldata = sheet!.celldata?.find((c) => c.r === 0 && c.c === 0)?.v as { v?: unknown } | undefined
    expect(fromData?.v).toBe(fromCelldata?.v)
  })

  it('createDefaultWorkbook stays EMPTY (import-detection relies on it)', () => {
    const [def] = createDefaultWorkbook()
    expect(def!.celldata ?? []).toHaveLength(0)
    expect(def!.data ?? []).toHaveLength(0)
  })
})
