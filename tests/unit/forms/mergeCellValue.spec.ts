import { describe, it, expect } from 'vitest'
import { submissionValueToCell } from '@/features/forms/utils/mergeCellValue'

/**
 * Pins the T019 fidelity fix: form submissions must merge number/currency
 * fields into the grid as NUMERIC cells (so they SUM/sort), not text.
 */
describe('submissionValueToCell', () => {
  it('number field → numeric cell (Deal=15000 must SUM/sort)', () => {
    expect(submissionValueToCell('number', 15000)).toEqual({ v: 15000, m: '15000' })
    expect(submissionValueToCell('number', '15000')).toEqual({ v: 15000, m: '15000' })
  })

  it('currency field strips punctuation before coercing', () => {
    expect(submissionValueToCell('currency', '₹15,000')).toEqual({ v: 15000, m: '15000' })
    expect(submissionValueToCell('currency', '$1,234.5')).toEqual({ v: 1234.5, m: '1234.5' })
  })

  it('non-numeric input on a numeric field falls back to text (no NaN cells)', () => {
    expect(submissionValueToCell('number', 'abc')).toEqual({ v: 'abc', m: 'abc' })
  })

  it('text/select/status fields stay strings', () => {
    expect(submissionValueToCell('text', 'Neha')).toEqual({ v: 'Neha', m: 'Neha' })
    expect(submissionValueToCell('status', 'New')).toEqual({ v: 'New', m: 'New' })
  })

  it('empty/null/undefined → empty cell', () => {
    expect(submissionValueToCell('number', null)).toEqual({ v: '', m: '' })
    expect(submissionValueToCell('text', undefined)).toEqual({ v: '', m: '' })
    expect(submissionValueToCell('currency', '')).toEqual({ v: '', m: '' })
  })
})
