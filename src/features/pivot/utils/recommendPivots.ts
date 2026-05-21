/**
 * recommendPivots
 * --------------------------------------------------------------------------
 * Pure data → pivot-suggestions function. Given the matrix of values (rows,
 * cols) and the header labels for each column, return 2-4 sensible
 * PivotConfig suggestions a user can apply with one click.
 *
 * Strategy (mirrors Excel's "Recommended PivotTables"):
 *   1. Profile each column: numeric, text, mixed
 *   2. Suggest one-dim aggregation per numeric column over each text column
 *      (e.g. "Sum of Revenue by Region")
 *   3. If at least 2 text columns + 1 numeric, suggest a cross-tab
 *      (e.g. "Sum of Revenue by Region × Category")
 *   4. If multiple numeric columns, suggest one multi-measure pivot
 *      (e.g. "Sum of Revenue, Sum of Cost by Region")
 *
 * Returns at most 4 suggestions, ranked by expected usefulness.
 */

import type { PivotConfig } from '../pivotAggregator'

export interface PivotRecommendation {
  title: string
  /** One-line subtitle shown under the title in the picker. */
  description: string
  config: PivotConfig
}

interface ColumnProfile {
  index: number
  kind: 'numeric' | 'text'
  distinctCount: number
}

function profileColumn(matrix: (string | number | null)[][], col: number): ColumnProfile {
  let numeric = 0
  let total = 0
  const seen = new Set<string>()
  for (let r = 0; r < Math.min(matrix.length, 50); r++) {
    const v = matrix[r]?.[col]
    if (v === null || v === undefined || v === '') continue
    total++
    seen.add(String(v))
    if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) numeric++
  }
  const kind = total > 0 && numeric / total >= 0.6 ? 'numeric' : 'text'
  return { index: col, kind, distinctCount: seen.size }
}

export function recommendPivots(
  matrix: (string | number | null)[][],
  headers: string[],
): PivotRecommendation[] {
  if (matrix.length === 0 || headers.length === 0) return []

  const cols = headers.map((_, c) => profileColumn(matrix, c))
  const numericCols = cols.filter((c) => c.kind === 'numeric')
  // "Good" text columns: ≥ 2 distinct values but not so many it makes a
  // useless pivot. Cap at distinctCount ≤ 50 to avoid e.g. a primary-key
  // column ending up in Rows.
  const textCols = cols
    .filter((c) => c.kind === 'text' && c.distinctCount >= 2 && c.distinctCount <= 50)
    .sort((a, b) => a.distinctCount - b.distinctCount)

  const recs: PivotRecommendation[] = []

  // 1) Single-dim aggregations — one suggestion per (text, numeric) pair,
  //    capped at the first 2 text columns × first 2 numeric columns so
  //    we don't flood the picker.
  for (const tc of textCols.slice(0, 2)) {
    for (const nc of numericCols.slice(0, 2)) {
      recs.push({
        title: `Sum of ${headers[nc.index]} by ${headers[tc.index]}`,
        description: `Aggregates "${headers[nc.index]}" with SUM across each distinct value of "${headers[tc.index]}".`,
        config: {
          rows: [tc.index],
          values: [{ column: nc.index, aggregate: 'sum', label: `sum of ${headers[nc.index]}` }],
        },
      })
    }
  }

  // 2) Cross-tab — first two text cols × first numeric col.
  if (textCols.length >= 2 && numericCols.length >= 1) {
    const t1 = textCols[0]!
    const t2 = textCols[1]!
    const nc = numericCols[0]!
    recs.push({
      title: `${headers[nc.index]} by ${headers[t1.index]} × ${headers[t2.index]}`,
      description: `Two-way breakdown: rows = "${headers[t1.index]}", columns = "${headers[t2.index]}", values = SUM of "${headers[nc.index]}".`,
      config: {
        rows: [t1.index],
        columns: [t2.index],
        values: [{ column: nc.index, aggregate: 'sum', label: `sum of ${headers[nc.index]}` }],
      },
    })
  }

  // 3) Multi-measure — first text col × ALL numeric cols (up to 4).
  if (textCols.length >= 1 && numericCols.length >= 2) {
    const tc = textCols[0]!
    const used = numericCols.slice(0, 4)
    recs.push({
      title: `${used.map((c) => headers[c.index]).join(', ')} by ${headers[tc.index]}`,
      description: `Multi-measure pivot: ${used.length} numeric columns aggregated with SUM across "${headers[tc.index]}".`,
      config: {
        rows: [tc.index],
        values: used.map((c) => ({
          column: c.index,
          aggregate: 'sum',
          label: `sum of ${headers[c.index]}`,
        })),
      },
    })
  }

  // Dedupe by config signature in case a small range produced duplicates.
  const seenSigs = new Set<string>()
  return recs
    .filter((r) => {
      const sig = JSON.stringify({ r: r.config.rows, c: r.config.columns, v: r.config.values })
      if (seenSigs.has(sig)) return false
      seenSigs.add(sig)
      return true
    })
    .slice(0, 4)
}
