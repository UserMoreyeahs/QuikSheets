/**
 * Modern Excel formula functions added on top of @formulajs/formulajs,
 * which is what @fortune-sheet/formula-parser uses to evaluate cell formulas.
 *
 * @formulajs/formulajs ships ~330 Excel functions but is missing several modern
 * ones (XLOOKUP, XMATCH, FILTER, SORT, SORTBY, UNIQUE, SEQUENCE, TEXTJOIN, LET,
 * IFS edge cases). We patch the namespace at module load time. Because Node's
 * CommonJS cache returns the same exports object reference across requires,
 * any consumer that hasn't yet copied the namespace via `_interopRequireWildcard`
 * will see the new functions.
 *
 * To guarantee FortuneSheet picks them up, this module must be imported BEFORE
 * the FortuneSheet dynamic import resolves — i.e. at the top of the sheet page.
 */

// Use namespace import so the module's exports object is the live one we patch.
// `* as` lets us assign properties without TS complaining.
// @formulajs/formulajs ships no .d.ts; declare it inline as a generic record.
// @ts-expect-error — no types ship with @formulajs/formulajs
import * as formulajs from '@formulajs/formulajs'

type AnyArgs = unknown[]
type Cell = string | number | boolean | null | undefined

// ─── Type helpers ─────────────────────────────────────────────────────────

function flat2D(arg: unknown): Cell[] {
  // Inputs from FortuneSheet may be either a flat array or a 2D array.
  if (Array.isArray(arg)) {
    if (arg.length > 0 && Array.isArray(arg[0])) {
      return (arg as unknown[][]).flat() as Cell[]
    }
    return arg as Cell[]
  }
  return [arg as Cell]
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const NA = '#N/A'

// ─── XLOOKUP ──────────────────────────────────────────────────────────────
// Excel: XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
// match_mode: 0 = exact (default), -1 = exact or next smaller, 1 = exact or next larger, 2 = wildcard
// search_mode: 1 = first to last (default), -1 = last to first, 2 = binary asc, -2 = binary desc

function xlookup(
  lookupValue: unknown,
  lookupArray: unknown,
  returnArray: unknown,
  ifNotFound: unknown = NA,
  matchMode: number = 0,
  searchMode: number = 1,
): unknown {
  const lookups = flat2D(lookupArray)
  const returns = flat2D(returnArray)
  if (lookups.length === 0) return ifNotFound

  const lv = lookupValue as Cell
  const isWildcard = matchMode === 2 && typeof lv === 'string'

  // Wildcard match: replace * and ? with regex equivalents
  const wildcardRe = isWildcard
    ? new RegExp(
        '^' +
          String(lv)
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') +
          '$',
        'i',
      )
    : null

  function isMatch(a: unknown, b: unknown): boolean {
    if (wildcardRe && typeof a === 'string') return wildcardRe.test(a)
    if (typeof a === 'number' && typeof b === 'number') return a === b
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
  }

  const order = searchMode === -1 ? -1 : 1
  const start = order === 1 ? 0 : lookups.length - 1
  const end = order === 1 ? lookups.length : -1

  // Direct exact / wildcard search
  if (matchMode === 0 || matchMode === 2) {
    for (let i = start; i !== end; i += order) {
      if (isMatch(lookups[i], lv)) return returns[i] ?? NA
    }
    return ifNotFound
  }

  // Approximate match: -1 (next smaller) or 1 (next larger)
  const lvNum = toNumber(lv)
  let bestIdx = -1
  let bestDelta = Infinity
  for (let i = 0; i < lookups.length; i++) {
    const candidate = toNumber(lookups[i])
    if (candidate === null || lvNum === null) continue
    if (candidate === lvNum) return returns[i] ?? NA
    const delta = lvNum - candidate
    if (matchMode === -1 && delta > 0 && delta < bestDelta) {
      bestDelta = delta
      bestIdx = i
    } else if (matchMode === 1 && delta < 0 && -delta < bestDelta) {
      bestDelta = -delta
      bestIdx = i
    }
  }
  if (bestIdx === -1) return ifNotFound
  return returns[bestIdx] ?? NA
}

// ─── XMATCH ───────────────────────────────────────────────────────────────
// XMATCH(lookup_value, lookup_array, [match_mode], [search_mode])
// Returns 1-based position. Same modes as XLOOKUP.

function xmatch(
  lookupValue: unknown,
  lookupArray: unknown,
  matchMode: number = 0,
  searchMode: number = 1,
): unknown {
  const arr = flat2D(lookupArray)
  if (arr.length === 0) return NA
  const lv = lookupValue as Cell
  const isWildcard = matchMode === 2 && typeof lv === 'string'
  const wildcardRe = isWildcard
    ? new RegExp(
        '^' +
          String(lv)
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') +
          '$',
        'i',
      )
    : null

  function isMatch(a: unknown, b: unknown): boolean {
    if (wildcardRe && typeof a === 'string') return wildcardRe.test(a)
    if (typeof a === 'number' && typeof b === 'number') return a === b
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
  }

  const order = searchMode === -1 ? -1 : 1
  const start = order === 1 ? 0 : arr.length - 1
  const end = order === 1 ? arr.length : -1

  if (matchMode === 0 || matchMode === 2) {
    for (let i = start; i !== end; i += order) {
      if (isMatch(arr[i], lv)) return i + 1
    }
    return NA
  }
  const lvNum = toNumber(lv)
  let bestIdx = -1
  let bestDelta = Infinity
  for (let i = 0; i < arr.length; i++) {
    const c = toNumber(arr[i])
    if (c === null || lvNum === null) continue
    if (c === lvNum) return i + 1
    const delta = lvNum - c
    if (matchMode === -1 && delta > 0 && delta < bestDelta) {
      bestDelta = delta
      bestIdx = i
    } else if (matchMode === 1 && delta < 0 && -delta < bestDelta) {
      bestDelta = -delta
      bestIdx = i
    }
  }
  return bestIdx === -1 ? NA : bestIdx + 1
}

// ─── FILTER ───────────────────────────────────────────────────────────────
// FILTER(array, include, [if_empty])
// include is a boolean-equivalent array. Returns a single column subset of array.

function filter(arr: unknown, include: unknown, ifEmpty: unknown = NA): unknown {
  const data = flat2D(arr)
  const mask = flat2D(include)
  const out: Cell[] = []
  const n = Math.min(data.length, mask.length)
  for (let i = 0; i < n; i++) {
    const v = mask[i]
    if (v === true || v === 1 || (typeof v === 'string' && v.toLowerCase() === 'true')) {
      out.push(data[i] ?? null)
    } else if (typeof v === 'number' && v !== 0) {
      out.push(data[i] ?? null)
    }
  }
  if (out.length === 0) return ifEmpty
  // FortuneSheet displays the first cell of an array result. Return the array
  // so other functions (SUM/COUNT/etc.) wrapping FILTER receive the full set.
  return out
}

// ─── SORT ─────────────────────────────────────────────────────────────────
// SORT(array, [sort_index], [sort_order], [by_col])
// sort_index: 1-based index of the column/row to sort by (default 1)
// sort_order: 1 = ascending (default), -1 = descending

function sort(arr: unknown, _sortIndex: number = 1, sortOrder: number = 1, _byCol = false): unknown {
  const data = flat2D(arr).filter((v) => v !== null && v !== undefined)
  const order = sortOrder === -1 ? -1 : 1
  const sorted = [...data].sort((a, b) => {
    const an = toNumber(a)
    const bn = toNumber(b)
    if (an !== null && bn !== null) return (an - bn) * order
    return String(a).localeCompare(String(b)) * order
  })
  return sorted
}

// ─── SORTBY ───────────────────────────────────────────────────────────────
// SORTBY(array, by_array1, [order1], [by_array2, order2, ...])

function sortby(arr: unknown, byArray1: unknown, order1: number = 1): unknown {
  const data = flat2D(arr)
  const keys = flat2D(byArray1)
  const ord = order1 === -1 ? -1 : 1
  const indexed = data.map((v, i) => ({ v, k: keys[i] }))
  indexed.sort((a, b) => {
    const an = toNumber(a.k)
    const bn = toNumber(b.k)
    if (an !== null && bn !== null) return (an - bn) * ord
    return String(a.k).localeCompare(String(b.k)) * ord
  })
  return indexed.map((x) => x.v)
}

// ─── UNIQUE ───────────────────────────────────────────────────────────────
// UNIQUE(array, [by_col], [exactly_once])

function unique(arr: unknown, _byCol = false, exactlyOnce = false): unknown {
  const data = flat2D(arr)
  if (exactlyOnce) {
    const counts = new Map<string, number>()
    for (const v of data) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
    return data.filter((v) => counts.get(String(v)) === 1)
  }
  const seen = new Set<string>()
  const out: Cell[] = []
  for (const v of data) {
    const k = String(v)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(v ?? null)
    }
  }
  return out
}

// ─── SEQUENCE ─────────────────────────────────────────────────────────────
// SEQUENCE(rows, [columns], [start], [step])

function sequence(rows: number, columns: number = 1, start: number = 1, step: number = 1): unknown {
  const out: number[] = []
  let v = start
  for (let i = 0; i < rows * columns; i++) {
    out.push(v)
    v += step
  }
  return out
}

// ─── TEXTJOIN ─────────────────────────────────────────────────────────────
// TEXTJOIN(delimiter, ignore_empty, text1, [text2], ...)

function textjoin(delimiter: unknown, ignoreEmpty: unknown, ...texts: AnyArgs): string {
  const delim = String(delimiter ?? '')
  const skipEmpty =
    ignoreEmpty === true ||
    ignoreEmpty === 1 ||
    (typeof ignoreEmpty === 'string' && ignoreEmpty.toLowerCase() === 'true')
  const parts: string[] = []
  for (const t of texts) {
    const flat = flat2D(t)
    for (const v of flat) {
      if (v === null || v === undefined || v === '') {
        if (!skipEmpty) parts.push('')
      } else {
        parts.push(String(v))
      }
    }
  }
  return parts.join(delim)
}

// ─── LET (limited) ────────────────────────────────────────────────────────
// LET(name1, value1, [name2, value2, ...], calculation)
// Naive impl: bind name -> value pairs, evaluate the final argument.
// Limitations: doesn't actually parse calculation as a formula; used only when
// the calculation is a literal value or pre-computed reference.

function letFn(...args: AnyArgs): unknown {
  if (args.length < 3 || args.length % 2 === 0) return '#N/A'
  // The last arg is the calculation; with our pre-evaluation flow it's already
  // resolved to a value, so we just return it.
  return args[args.length - 1]
}

// ─── IFS robustness ────────────────────────────────────────────────────────
// formulajs's IFS exists but rejects non-strict booleans. Override to accept
// truthy values like Excel does.

function ifs(...args: AnyArgs): unknown {
  for (let i = 0; i < args.length; i += 2) {
    const cond = args[i]
    if (cond === true || cond === 1 || (typeof cond === 'string' && cond.toLowerCase() === 'true')) {
      return args[i + 1]
    }
    if (typeof cond === 'number' && cond !== 0) return args[i + 1]
  }
  return NA
}

// ─── Apply patches ─────────────────────────────────────────────────────────

const patches: Record<string, (...args: AnyArgs) => unknown> = {
  XLOOKUP: xlookup as (...args: AnyArgs) => unknown,
  XMATCH:  xmatch  as (...args: AnyArgs) => unknown,
  FILTER:  filter  as (...args: AnyArgs) => unknown,
  SORT:    sort    as (...args: AnyArgs) => unknown,
  SORTBY:  sortby  as (...args: AnyArgs) => unknown,
  UNIQUE:  unique  as (...args: AnyArgs) => unknown,
  SEQUENCE: sequence as (...args: AnyArgs) => unknown,
  TEXTJOIN: textjoin as (...args: AnyArgs) => unknown,
  LET:     letFn   as (...args: AnyArgs) => unknown,
  IFS:     ifs,
}

// Mutate the imported namespace. Cast through unknown because TS sees the
// module as readonly.
const ns = formulajs as unknown as Record<string, (...args: AnyArgs) => unknown>
for (const [name, impl] of Object.entries(patches)) {
  ns[name] = impl
}

export const PATCHED_FUNCTIONS = Object.keys(patches)

// Re-export so importing this file ensures the side effect runs.
export {}
