/**
 * Deterministic data cleaners — fast, no network round-trip.
 *
 * Each cleaner takes a string and returns the cleaned string.  When a value
 * is unparseable we return it untouched (never throw, never produce NaN/Invalid
 * Date strings) so the user can spot-fix manually.
 */

export type DeterministicCleanOp =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'titlecase'
  | 'phone'
  | 'date_iso'

export type CleanOp = DeterministicCleanOp | 'custom'

// ── Case + whitespace ────────────────────────────────────────────────────────

export function trim(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function toLowerCase(value: string): string {
  return value.toLocaleLowerCase()
}

export function toUpperCase(value: string): string {
  return value.toLocaleUpperCase()
}

export function toTitleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/(^|\s|[-_/])([\p{L}\p{N}])/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase())
}

// ── Phone numbers ────────────────────────────────────────────────────────────

/**
 * Normalize Indian / international phone numbers to E.164-ish format.
 *
 *   "98765 43210"        → "+91-9876543210"
 *   "+91-9876543210"     → "+91-9876543210"
 *   "+1 (415) 555-1234"  → "+1-4155551234"
 *   "9876543210"         → "+91-9876543210"   (defaults country to +91)
 *   "abc"                → "abc" (unchanged — caller can spot it)
 */
export function normalizePhone(value: string, defaultCountry: string = '91'): string {
  const raw = value.trim()
  if (!raw) return raw

  // strip everything but digits + leading +
  const hasPlus = raw.startsWith('+')
  const digits = raw.replace(/[^\d]/g, '')

  if (digits.length < 7) return value // too short — likely not a phone

  let cc = defaultCountry
  let national = digits

  if (hasPlus) {
    // assume country code is the first 1–3 leading digits
    if (digits.startsWith('91') && digits.length === 12) {
      cc = '91'
      national = digits.slice(2)
    } else if (digits.startsWith('1') && digits.length === 11) {
      cc = '1'
      national = digits.slice(1)
    } else if (digits.length > 10) {
      cc = digits.slice(0, digits.length - 10)
      national = digits.slice(-10)
    } else {
      national = digits
    }
  } else if (digits.length === 12 && digits.startsWith('91')) {
    cc = '91'
    national = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('1')) {
    cc = '1'
    national = digits.slice(1)
  } else if (digits.length === 10) {
    national = digits
  } else {
    // give up — return raw input
    return value
  }

  return `+${cc}-${national}`
}

// ── Dates ────────────────────────────────────────────────────────────────────

/**
 * Parse a wide variety of date strings and return ISO `YYYY-MM-DD`.
 * Supported inputs:
 *   2026-04-30, 30/04/2026, 30-04-2026, 04/30/2026 (US),
 *   "30 Apr 2026", "Apr 30 2026", "April 30, 2026", JS Date.parse() output.
 *
 * Ambiguous DD/MM vs MM/DD is resolved by detecting day > 12.
 * Returns the original value if no format matches.
 */
export function normalizeDateIso(value: string): string {
  const raw = value.trim()
  if (!raw) return raw

  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // dd/mm/yyyy or mm/dd/yyyy or dd-mm-yyyy
  const slashOrDash = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (slashOrDash) {
    const a = Number(slashOrDash[1])
    const b = Number(slashOrDash[2])
    let y = Number(slashOrDash[3])
    if (y < 100) y += 2000
    // if first part > 12 it must be day (DD/MM)
    // if second part > 12 it must be day (MM/DD/YYYY US)
    let dd = a
    let mm = b
    if (a > 12 && b <= 12) { dd = a; mm = b }
    else if (b > 12 && a <= 12) { dd = b; mm = a }
    // else default to DD/MM (ISO-friendly bias)
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y.toString().padStart(4, '0')}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`
    }
  }

  // textual: "30 Apr 2026", "April 30, 2026", "Apr 30 2026"
  const parsed = Date.parse(raw)
  if (!isNaN(parsed)) {
    const d = new Date(parsed)
    const y = d.getUTCFullYear()
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = d.getUTCDate().toString().padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return value
}

// ── Generic dispatcher ───────────────────────────────────────────────────────

export function applyDeterministic(values: string[], op: DeterministicCleanOp): string[] {
  const fn: (value: string) => string =
    op === 'trim'       ? trim       :
    op === 'lowercase'  ? toLowerCase :
    op === 'uppercase'  ? toUpperCase :
    op === 'titlecase'  ? toTitleCase :
    op === 'phone'      ? (value: string) => normalizePhone(value) :
    op === 'date_iso'   ? normalizeDateIso :
    /* fallback */         (value: string) => value
  return values.map((v) => fn(v))
}

/**
 * Compute a quick before/after diff for the panel preview — counts how many
 * values actually change so the user knows whether the clean is a no-op.
 */
export function diffCount(before: string[], after: string[]): number {
  let changed = 0
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) changed++
  }
  return changed
}
