/**
 * Excel-style pivot aggregator.
 *
 *   • rows[]   — column indexes used as row groupings
 *   • columns[] — column indexes used as column groupings (Excel "Columns" zone)
 *   • values[] — measures (column + aggregate fn)
 *   • filters[] — column indexes whose value must equal a chosen literal (Excel "Filters" zone)
 *
 * Result shape mirrors Excel's grid:
 *   columnHeaders[][]  — multi-level headers (one row per `columns` field, plus
 *                        a final row of value labels; empty array when no columns)
 *   rows[]             — { keys, valuesByCol }
 *
 * `valuesByCol[c][v]` is the aggregate for value-index `v` under column-key
 * index `c` (where `c` indexes into `columnKeys`).
 */

export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max'

export interface PivotValueSpec {
  column: number
  aggregate: AggregateFn
  label?: string
}

export interface PivotFilter {
  column: number
  /** Allowed literal values (strings); a row passes if its column value is in this set. */
  allowed: string[]
}

/**
 * Calculated field — a virtual measure computed from other value fields
 * using a simple expression (e.g. "Revenue - Cost", "Revenue * 0.1").
 *
 * The expression is evaluated post-aggregation: each referenced name resolves
 * to the aggregated value of the value-spec with a matching label.
 */
export interface CalculatedField {
  id: string
  name: string
  /** Simple math expression referencing other value labels, e.g. "Revenue - Cost" */
  expression: string
}

export interface PivotConfig {
  rows: number[]
  columns?: number[]
  values: PivotValueSpec[]
  filters?: PivotFilter[]
  calculatedFields?: CalculatedField[]
}

export interface PivotResult {
  /**
   * Display labels for the leftmost row-key columns (length === config.rows.length).
   * Set by the caller from header row, not by the aggregator.
   */
  rowKeyLabels: string[]
  /** Column keys (length === number of column groupings); empty when no `columns`. */
  columnKeys: string[][]
  /** Value labels — repeats once per column key. Length === columnKeys.length * values.length. */
  valueLabels: string[]
  /** Each row: keys[i] indexes into rows[i], valuesByCol[c][v] is aggregate. */
  rows: Array<{
    keys: string[]
    /** valuesByCol.length === columnKeys.length (or 1 when no columns) */
    valuesByCol: number[][]
  }>
  /** Optional row + column totals (sum across all values; computed lazily by caller). */
}

const DELIM = '\x00'

// ── Simple expression evaluator for calculated fields ────────────────
// Supports: +, -, *, /, parentheses, numeric literals, and field-name
// references (matched case-insensitively against value labels).

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'ref'; value: string }

function tokenize(expr: string, fieldNames: string[]): Token[] {
  const tokens: Token[] = []
  // Sort field names longest-first so "Revenue Total" matches before "Revenue"
  const sortedNames = [...fieldNames].sort((a, b) => b.length - a.length)
  let i = 0
  while (i < expr.length) {
    if (/\s/.test(expr[i] ?? '')) { i++; continue }
    // Operator / paren
    if ('+-*/()'.includes(expr[i] ?? '')) {
      tokens.push({ type: 'op', value: expr[i] as string })
      i++
      continue
    }
    // Number literal
    const numMatch = expr.slice(i).match(/^(\d+(?:\.\d+)?)/)
    if (numMatch) {
      tokens.push({ type: 'num', value: Number(numMatch[1]) })
      i += (numMatch[1] as string).length
      continue
    }
    // Field name reference
    const remaining = expr.slice(i).toLowerCase()
    let matched = false
    for (const name of sortedNames) {
      if (remaining.startsWith(name.toLowerCase())) {
        tokens.push({ type: 'ref', value: name })
        i += name.length
        matched = true
        break
      }
    }
    if (!matched) { i++; } // skip unknown chars
  }
  return tokens
}

function parseExpression(tokens: Token[], pos: { i: number }): (vars: Record<string, number>) => number {
  let left = parseTerm(tokens, pos)
  while (pos.i < tokens.length) {
    const tok = tokens[pos.i]
    if (!tok || tok.type !== 'op' || (tok.value !== '+' && tok.value !== '-')) break
    pos.i++
    const right = parseTerm(tokens, pos)
    const op = tok.value
    const prevLeft = left
    left = op === '+'
      ? (v: Record<string, number>) => prevLeft(v) + right(v)
      : (v: Record<string, number>) => prevLeft(v) - right(v)
  }
  return left
}

function parseTerm(tokens: Token[], pos: { i: number }): (vars: Record<string, number>) => number {
  let left = parseFactor(tokens, pos)
  while (pos.i < tokens.length) {
    const tok = tokens[pos.i]
    if (!tok || tok.type !== 'op' || (tok.value !== '*' && tok.value !== '/')) break
    pos.i++
    const right = parseFactor(tokens, pos)
    const op = tok.value
    const prevLeft = left
    left = op === '*'
      ? (v: Record<string, number>) => prevLeft(v) * right(v)
      : (v: Record<string, number>) => { const d = right(v); return d === 0 ? 0 : prevLeft(v) / d }
  }
  return left
}

function parseFactor(tokens: Token[], pos: { i: number }): (vars: Record<string, number>) => number {
  const tok = tokens[pos.i]
  if (!tok) return () => 0
  if (tok.type === 'num') { pos.i++; const n = tok.value; return () => n }
  if (tok.type === 'ref') { pos.i++; const name = tok.value; return (v) => v[name] ?? 0 }
  if (tok.type === 'op' && tok.value === '(') {
    pos.i++ // skip (
    const inner = parseExpression(tokens, pos)
    if (tokens[pos.i]?.type === 'op' && tokens[pos.i]?.value === ')') pos.i++ // skip )
    return inner
  }
  // Unary minus
  if (tok.type === 'op' && tok.value === '-') {
    pos.i++
    const inner = parseFactor(tokens, pos)
    return (v) => -inner(v)
  }
  pos.i++
  return () => 0
}

export function compileCalcExpression(
  expression: string,
  fieldNames: string[],
): (vars: Record<string, number>) => number {
  const tokens = tokenize(expression, fieldNames)
  const pos = { i: 0 }
  return parseExpression(tokens, pos)
}

function aggregate(values: number[], fn: AggregateFn): number {
  if (values.length === 0) return 0
  switch (fn) {
    case 'sum':   return values.reduce((a, b) => a + b, 0)
    case 'avg':   return values.reduce((a, b) => a + b, 0) / values.length
    case 'count': return values.length
    case 'min':   return Math.min(...values)
    case 'max':   return Math.max(...values)
  }
}

export function pivot(matrix: (string | number | null)[][], config: PivotConfig): PivotResult {
  const filters = config.filters ?? []
  const cols = config.columns ?? []
  const passesFilter = (row: (string | number | null)[]) =>
    filters.every((f) => f.allowed.length === 0 || f.allowed.includes(String(row[f.column] ?? '')))

  // First pass — bucket each surviving row into (rowKey, colKey)
  const rowKeySet = new Set<string>()
  const colKeySet = new Set<string>()
  const buckets = new Map<string, Map<string, (string | number | null)[][]>>()

  for (const row of matrix) {
    if (!passesFilter(row)) continue
    const rowKey = config.rows.map((c) => String(row[c] ?? '')).join(DELIM)
    const colKey = cols.map((c) => String(row[c] ?? '')).join(DELIM)
    rowKeySet.add(rowKey)
    colKeySet.add(colKey)
    let inner = buckets.get(rowKey)
    if (!inner) { inner = new Map(); buckets.set(rowKey, inner) }
    const list = inner.get(colKey)
    if (list) list.push(row)
    else inner.set(colKey, [row])
  }

  const rowKeys = Array.from(rowKeySet).sort()
  const colKeys = cols.length === 0 ? [''] : Array.from(colKeySet).sort()

  // Build value labels — Excel repeats each value's label under each column key.
  const valueLabelsBase = config.values.map((v) => v.label ?? `${v.aggregate} of ${v.column}`)
  const valueLabels: string[] = []
  for (const _colKey of colKeys) {
    for (const lbl of valueLabelsBase) valueLabels.push(lbl)
    void _colKey
  }

  // Second pass — fill the value matrix
  const rows: PivotResult['rows'] = rowKeys.map((rk) => {
    const keyParts = rk.split(DELIM)
    const inner = buckets.get(rk) ?? new Map()
    const valuesByCol: number[][] = colKeys.map((ck) => {
      const cellRows = inner.get(ck) ?? []
      return config.values.map((v) =>
        aggregate(
          cellRows
            .map((r: (string | number | null)[]) => Number(r[v.column] ?? 0))
            .filter((n: number) => Number.isFinite(n)),
          v.aggregate
        )
      )
    })
    return { keys: keyParts, valuesByCol }
  })

  // ── Calculated fields (post-aggregation) ──────────────────────────
  const calcFields = config.calculatedFields ?? []
  if (calcFields.length > 0) {
    const baseLabelCount = valueLabelsBase.length
    // Compile each calculated field expression
    const compiled = calcFields.map((cf) => ({
      ...cf,
      fn: compileCalcExpression(cf.expression, valueLabelsBase),
    }))

    // Append labels for calculated fields (repeated per column key like normal values)
    for (const _ck of colKeys) {
      for (const cf of compiled) valueLabels.push(cf.name)
      void _ck
    }

    // Append calculated values to each row
    for (const row of rows) {
      const newValuesByCol = row.valuesByCol.map((colVals) => {
        // Build a lookup from base value labels to their aggregated values
        const vars: Record<string, number> = {}
        for (let vi = 0; vi < baseLabelCount; vi++) {
          const label = valueLabelsBase[vi]
          if (label) vars[label] = colVals[vi] ?? 0
        }
        // Evaluate each calculated field
        const calcVals = compiled.map((cf) => {
          try { return cf.fn(vars) } catch { return 0 }
        })
        return [...colVals, ...calcVals]
      })
      row.valuesByCol = newValuesByCol
    }
  }

  return {
    rowKeyLabels: [],
    columnKeys: cols.length === 0 ? [] : colKeys.map((k) => k.split(DELIM)),
    valueLabels,
    rows,
  }
}
