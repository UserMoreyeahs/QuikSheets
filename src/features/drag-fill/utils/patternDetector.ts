/**
 * Smart pattern detector for cell drag-fill.
 *
 * Given a sequence of source values, detects the pattern and generates
 * the next N values. Supports:
 *
 *   • Arithmetic series (1, 2, 3 → 4, 5, 6)
 *   • Geometric/constant patterns (5, 5, 5 → 5, 5, 5)
 *   • Date series (Jan, Feb, Mar → Apr, May, Jun)
 *   • Day-of-week (Mon, Tue, Wed → Thu, Fri, Sat)
 *   • Alternating patterns (A, B, A, B → A, B)
 *   • Text with trailing number (Item 1, Item 2 → Item 3)
 *   • Plain repeat (copies the source sequence cyclically)
 */

export type FillDirection = 'down' | 'right' | 'up' | 'left'

export interface FillResult {
  values: (string | number)[]
  /** Human-readable description of the detected pattern. */
  pattern: string
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function matchCyclicList(values: string[], list: string[]): { startIdx: number } | null {
  if (values.length === 0) return null
  const lower = list.map((s) => s.toLowerCase())
  const firstIdx = lower.indexOf(values[0]?.toLowerCase() ?? '')
  if (firstIdx === -1) return null
  for (let i = 1; i < values.length; i++) {
    const expected = lower[(firstIdx + i) % lower.length]
    if (values[i]?.toLowerCase() !== expected) return null
  }
  return { startIdx: firstIdx }
}

function isNumeric(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined || v === '') return false
  return !isNaN(Number(v))
}

/** Extract trailing number from a string: "Item 3" → { prefix: "Item ", num: 3 } */
function splitTrailingNumber(s: string): { prefix: string; num: number } | null {
  const match = s.match(/^(.*?)(\d+)\s*$/)
  if (!match) return null
  return { prefix: match[1] ?? '', num: Number(match[2]) }
}

export function detectAndFill(
  sourceValues: (string | number | null | undefined)[],
  count: number,
): FillResult {
  if (sourceValues.length === 0 || count === 0) {
    return { values: [], pattern: 'empty' }
  }

  const strs = sourceValues.map((v) => (v === null || v === undefined ? '' : String(v)))

  // ── 1. All numeric → detect arithmetic series ──────────────────
  if (strs.every((s) => isNumeric(s))) {
    const nums = strs.map(Number)
    if (nums.length === 1) {
      // Single number — just repeat (Excel behavior)
      const n = nums[0] ?? 0
      return { values: Array.from({ length: count }, () => n), pattern: 'repeat' }
    }
    // Check constant step
    const step = (nums[1] ?? 0) - (nums[0] ?? 0)
    const isArithmetic = nums.every((n, i) => i === 0 || Math.abs(n - ((nums[0] ?? 0) + step * i)) < 1e-10)
    if (isArithmetic) {
      const last = nums[nums.length - 1] ?? 0
      const values = Array.from({ length: count }, (_, i) => {
        const val = last + step * (i + 1)
        // Preserve integer-ness
        return Number.isInteger(step) && Number.isInteger(last) ? val : Math.round(val * 1e10) / 1e10
      })
      return {
        values,
        pattern: step === 0 ? 'constant' : `arithmetic (+${step})`,
      }
    }
    // Fallback: repeat cyclically
    return {
      values: Array.from({ length: count }, (_, i) => nums[i % nums.length] ?? 0),
      pattern: 'repeat numbers',
    }
  }

  // ── 2. Month names ─────────────────────────────────────────────
  const shortMonth = matchCyclicList(strs, MONTHS_SHORT)
  if (shortMonth) {
    const startNext = shortMonth.startIdx + strs.length
    return {
      values: Array.from({ length: count }, (_, i) => MONTHS_SHORT[(startNext + i) % 12] ?? ''),
      pattern: 'months',
    }
  }
  const fullMonth = matchCyclicList(strs, MONTHS_FULL)
  if (fullMonth) {
    const startNext = fullMonth.startIdx + strs.length
    return {
      values: Array.from({ length: count }, (_, i) => MONTHS_FULL[(startNext + i) % 12] ?? ''),
      pattern: 'months',
    }
  }

  // ── 3. Day names ───────────────────────────────────────────────
  const shortDay = matchCyclicList(strs, DAYS_SHORT)
  if (shortDay) {
    const startNext = shortDay.startIdx + strs.length
    return {
      values: Array.from({ length: count }, (_, i) => DAYS_SHORT[(startNext + i) % 7] ?? ''),
      pattern: 'days',
    }
  }
  const fullDay = matchCyclicList(strs, DAYS_FULL)
  if (fullDay) {
    const startNext = fullDay.startIdx + strs.length
    return {
      values: Array.from({ length: count }, (_, i) => DAYS_FULL[(startNext + i) % 7] ?? ''),
      pattern: 'days',
    }
  }

  // ── 4. Text with trailing number (Item 1, Item 2 → Item 3) ────
  const splits = strs.map(splitTrailingNumber)
  if (splits.every((s) => s !== null)) {
    const validSplits = splits as { prefix: string; num: number }[]
    const prefix = validSplits[0]?.prefix ?? ''
    const allSamePrefix = validSplits.every((s) => s.prefix === prefix)
    if (allSamePrefix && validSplits.length > 0) {
      const nums = validSplits.map((s) => s.num)
      const step = validSplits.length > 1 ? ((nums[1] ?? 0) - (nums[0] ?? 0)) : 1
      const lastNum = nums[nums.length - 1] ?? 0
      return {
        values: Array.from({ length: count }, (_, i) => `${prefix}${lastNum + step * (i + 1)}`),
        pattern: `text series "${prefix}N"`,
      }
    }
  }

  // ── 5. Date strings (ISO / locale) ─────────────────────────────
  const dates = strs.map((s) => new Date(s))
  const allDates = dates.every((d) => !isNaN(d.getTime()))
  if (allDates && dates.length >= 2) {
    const times = dates.map((d) => d.getTime())
    const step = (times[1] ?? 0) - (times[0] ?? 0)
    const lastTime = times[times.length - 1] ?? 0
    // Check if step is roughly constant (within 2 hours for daily series)
    const isConstantStep = times.every(
      (t, i) => i === 0 || Math.abs(t - ((times[0] ?? 0) + step * i)) < 7200000
    )
    if (isConstantStep && step !== 0) {
      const isIso = strs[0]?.includes('-') ?? false
      return {
        values: Array.from({ length: count }, (_, i) => {
          const d = new Date(lastTime + step * (i + 1))
          return isIso ? d.toISOString().split('T')[0] ?? '' : d.toLocaleDateString()
        }),
        pattern: 'date series',
      }
    }
  }

  // ── 6. Fallback: cyclic repeat ─────────────────────────────────
  return {
    values: Array.from({ length: count }, (_, i) => strs[i % strs.length] ?? ''),
    pattern: 'repeat',
  }
}
