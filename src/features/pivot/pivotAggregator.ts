export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max'

export interface PivotConfig {
  rows: number[] // column indexes used as row groupings
  values: Array<{ column: number; aggregate: AggregateFn; label?: string }>
}

export interface PivotResult {
  columnLabels: string[]
  rows: Array<{ key: string[]; values: number[] }>
}

export function pivot(matrix: (string | number | null)[][], config: PivotConfig): PivotResult {
  const groups = new Map<string, Array<(string | number | null)[]>>()
  for (const row of matrix) {
    const key = config.rows.map((c) => String(row[c] ?? '')).join('||')
    const existing = groups.get(key)
    if (existing) existing.push(row)
    else groups.set(key, [row])
  }

  const out: PivotResult['rows'] = []
  for (const [key, rows] of groups) {
    const keyParts = key.split('||')
    const values = config.values.map((v) => aggregate(rows.map((r) => Number(r[v.column] ?? 0)), v.aggregate))
    out.push({ key: keyParts, values })
  }
  out.sort((a, b) => a.key.join('|').localeCompare(b.key.join('|')))

  return {
    columnLabels: config.values.map((v) => v.label ?? `${v.aggregate} of ${v.column}`),
    rows: out,
  }
}

function aggregate(values: number[], fn: AggregateFn): number {
  if (values.length === 0) return 0
  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'count':
      return values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
}
