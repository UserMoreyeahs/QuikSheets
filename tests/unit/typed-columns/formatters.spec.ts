import { describe, it, expect } from 'vitest'
import {
  formatForDisplay,
  validateForEdit,
} from '@/features/typed-columns/utils/columnTypeFormatters'
import type { ColumnTypeMeta } from '@/features/typed-columns/types'

describe('typed-columns formatForDisplay', () => {
  it('renders currency with ₹ prefix and 2 decimals', () => {
    const meta: ColumnTypeMeta = { type: 'currency' }
    expect(formatForDisplay(12000, meta)).toBe('₹12,000.00')
    expect(formatForDisplay(5500.5, meta)).toBe('₹5,500.50')
  })

  it('renders number with locale separators, no decimals by default', () => {
    expect(formatForDisplay(1234567, { type: 'number' })).toBe('12,34,567')
  })

  it('renders date as dd-MMM-yyyy by default', () => {
    const out = formatForDisplay('2026-05-19', { type: 'date' })
    expect(out).toMatch(/19-May-2026/)
  })

  it('renders checkbox as ☑ or ☐', () => {
    expect(formatForDisplay(true, { type: 'checkbox' })).toBe('☑')
    expect(formatForDisplay(false, { type: 'checkbox' })).toBe('☐')
    expect(formatForDisplay('yes', { type: 'checkbox' })).toBe('☑')
    expect(formatForDisplay('no', { type: 'checkbox' })).toBe('☐')
  })

  it('returns empty string for null/undefined regardless of type', () => {
    expect(formatForDisplay(null, { type: 'currency' })).toBe('')
    expect(formatForDisplay(undefined, { type: 'date' })).toBe('')
    expect(formatForDisplay('', { type: 'text' })).toBe('')
  })

  it('passes through untyped (no meta) values as String', () => {
    expect(formatForDisplay(42, undefined)).toBe('42')
  })
})

describe('typed-columns validateForEdit', () => {
  it('accepts empty input as clear', () => {
    expect(validateForEdit('', { type: 'currency' })).toEqual({ ok: true, value: '' })
  })

  it('rejects non-numeric for currency / number', () => {
    expect(validateForEdit('abc', { type: 'currency' }).ok).toBe(false)
    expect(validateForEdit('abc', { type: 'number' }).ok).toBe(false)
  })

  it('strips currency punctuation for numeric types', () => {
    const r = validateForEdit('₹12,000', { type: 'currency' })
    expect(r).toEqual({ ok: true, value: 12000 })
  })

  it('accepts both DD-MM-YYYY and ISO for date', () => {
    const a = validateForEdit('19-05-2026', { type: 'date' })
    const b = validateForEdit('2026-05-19', { type: 'date' })
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (a.ok) expect(a.value).toBe('2026-05-19')
    if (b.ok) expect(b.value).toBe('2026-05-19')
  })

  it('normalises checkbox input to boolean', () => {
    const yes = validateForEdit('Yes', { type: 'checkbox' })
    const no = validateForEdit('No', { type: 'checkbox' })
    expect(yes).toEqual({ ok: true, value: true })
    expect(no).toEqual({ ok: true, value: false })
  })

  it('rejects select values outside the options list', () => {
    const meta: ColumnTypeMeta = { type: 'select', options: ['Lead', 'Customer'] }
    const r = validateForEdit('Vendor', meta)
    expect(r.ok).toBe(false)
  })

  it('normalises select value case to match canonical option', () => {
    const meta: ColumnTypeMeta = { type: 'select', options: ['Active', 'Pending'] }
    const r = validateForEdit('active', meta)
    expect(r).toEqual({ ok: true, value: 'Active' })
  })

  it('allows any value for select with empty options', () => {
    const r = validateForEdit('Anything', { type: 'select', options: [] })
    expect(r.ok).toBe(true)
  })
})
