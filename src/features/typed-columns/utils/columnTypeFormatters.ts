/**
 * Pure formatting + validation helpers for typed columns.
 *
 * Two main concerns:
 *
 *  1. `formatForDisplay(value, meta)` — returns the string shown in the cell.
 *     Used by the grid's `m` (display text) field per FortuneSheet conventions.
 *
 *  2. `validateForEdit(rawInput, meta)` — returns either a sanitized value
 *     to commit, or an error message string to show via toast.
 *     The grid's afterCellEdit handler calls this and reverts on failure.
 *
 * Both functions are deterministic and dependency-free — easy to unit-test.
 */

import type { ColumnTypeMeta } from '../types'

// ─────────────────────────────────────────────────────────────────────────
// Display formatters
// ─────────────────────────────────────────────────────────────────────────

/**
 * Render a raw cell value for display given the column's type metadata.
 * Returns the original stringified value when the type is plain text or
 * the value is empty.
 */
export function formatForDisplay(value: unknown, meta: ColumnTypeMeta | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (!meta) return String(value)

  switch (meta.type) {
    case 'currency':
      return formatCurrency(value, meta)
    case 'number':
      return formatNumber(value, meta)
    case 'date':
      return formatDate(value, meta)
    case 'checkbox':
      return formatCheckbox(value)
    case 'status':
    case 'select':
      // Render the value as-is; the colored chip is applied by CSS / cell style.
      return String(value)
    case 'text':
    default:
      return String(value)
  }
}

function formatCurrency(value: unknown, meta: ColumnTypeMeta): string {
  const n = toNumber(value)
  if (n === null) return String(value)
  const symbol = meta.currencySymbol ?? '₹'
  const decimals = meta.decimals ?? 2
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${symbol}${formatted}`
}

function formatNumber(value: unknown, meta: ColumnTypeMeta): string {
  const n = toNumber(value)
  if (n === null) return String(value)
  const decimals = meta.decimals ?? 0
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(value: unknown, meta: ColumnTypeMeta): string {
  const d = parseLooseDate(value)
  if (!d) return String(value)
  const fmt = meta.dateFormat ?? 'short'
  // Use LOCAL date parts to avoid UTC shifts in negative-offset zones.
  const day = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const yr = d.getFullYear()
  switch (fmt) {
    case 'iso':
      return `${yr}-${mo}-${day}`
    case 'long':
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    case 'short':
    default: {
      const monShort = d.toLocaleDateString('en-IN', { month: 'short' })
      return `${day}-${monShort}-${yr}`
    }
  }
}

function formatCheckbox(value: unknown): string {
  return isTruthy(value) ? '☑' : '☐'
}

// ─────────────────────────────────────────────────────────────────────────
// Edit-time validators
// ─────────────────────────────────────────────────────────────────────────

export type ValidateResult =
  | { ok: true; value: string | number | boolean }
  | { ok: false; error: string }

/**
 * Validate (and sanitize) a user input against the column's type.
 *
 * Returns `{ ok: true, value }` with the canonical form to commit, OR
 * `{ ok: false, error }` describing why the value was rejected.
 *
 * Empty input is always accepted (clears the cell).
 */
export function validateForEdit(
  rawInput: unknown,
  meta: ColumnTypeMeta | undefined,
): ValidateResult {
  // Empty is always allowed — represents clearing the cell.
  if (rawInput === null || rawInput === undefined || rawInput === '') {
    return { ok: true, value: '' }
  }
  if (!meta) return { ok: true, value: String(rawInput) }

  switch (meta.type) {
    case 'currency':
    case 'number': {
      const n = toNumber(rawInput)
      if (n === null) return { ok: false, error: `${meta.type === 'currency' ? 'Currency' : 'Number'} required` }
      return { ok: true, value: n }
    }

    case 'date': {
      const d = parseLooseDate(rawInput)
      if (!d) return { ok: false, error: 'Date required (try DD-MM-YYYY or YYYY-MM-DD)' }
      // Canonical form: YYYY-MM-DD built from LOCAL date parts.
      // Avoid `.toISOString()` here — it converts to UTC, which shifts
      // the date back one day in negative-UTC-offset zones (e.g. India,
      // where 2026-05-19 00:00 IST is 2026-05-18 18:30 UTC).
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return { ok: true, value: `${yr}-${mo}-${da}` }
    }

    case 'checkbox': {
      const str = String(rawInput).trim().toLowerCase()
      if (['true', '1', 'yes', 'y', '✓', '☑', 'checked'].includes(str)) {
        return { ok: true, value: true }
      }
      if (['false', '0', 'no', 'n', '✗', '☐', 'unchecked', ''].includes(str)) {
        return { ok: true, value: false }
      }
      return { ok: false, error: 'Must be yes/no, true/false, or 1/0' }
    }

    case 'select':
    case 'status': {
      const str = String(rawInput).trim()
      const allowed = meta.options ?? []
      if (allowed.length === 0) return { ok: true, value: str } // unconfigured — allow any
      const match = allowed.find((o) => o.toLowerCase() === str.toLowerCase())
      if (!match) {
        return {
          ok: false,
          error: `Allowed: ${allowed.slice(0, 5).join(', ')}${allowed.length > 5 ? '…' : ''}`,
        }
      }
      return { ok: true, value: match } // normalise to canonical case
    }

    case 'text':
    default:
      return { ok: true, value: String(rawInput) }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Internal coercion helpers
// ─────────────────────────────────────────────────────────────────────────

/** Coerce input to a finite number, or null if not numeric. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value !== 'string') return null
  // Strip common currency / thousands punctuation: ₹ $ € £ ,
  const cleaned = value.replace(/[₹$€£,\s]/g, '').trim()
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Parse a date from many common formats: ISO, dd-mm-yyyy, dd/mm/yyyy, mm/dd/yyyy. */
function parseLooseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value !== 'string') return null
  const str = value.trim()
  if (!str) return null

  // ISO short — 2026-05-19
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // DD-MM-YYYY / DD/MM/YYYY (India default) — prefer this over US MM/DD.
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const mon = Number(dmy[2])
    const yr = Number(dmy[3])
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      const d = new Date(yr, mon - 1, day)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }

  // Fallback: native Date constructor (handles long form like "May 19, 2026").
  const fallback = new Date(str)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Decide whether a value should be considered "checked" for checkbox cells. */
function isTruthy(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'number') return value !== 0
  const str = String(value ?? '').trim().toLowerCase()
  return ['true', '1', 'yes', 'y', '✓', '☑', 'checked'].includes(str)
}
