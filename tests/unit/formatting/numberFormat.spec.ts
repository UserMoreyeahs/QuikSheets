import { describe, it, expect } from 'vitest'
import { numberFormatString } from '@/store/sheetStore'

/**
 * Excel-parity contract for the toolbar Number-Format masks.
 *
 * Regression pin for the "Currency" gap: Excel's Currency format ALWAYS groups
 * thousands ($#,##0.00 → "$12,000.00"). The old mask '$0.00' rendered
 * "$12000.00", which differs from Excel. (The locale currency SYMBOL — ₹/€/£ —
 * is applied by the Accounting ribbon button, not this enum.)
 */
describe('numberFormatString — Excel-parity masks', () => {
  it('currency groups thousands like Excel ($#,##0.00, not $0.00)', () => {
    const mask = numberFormatString('currency')
    expect(mask).toBe('$#,##0.00')
    expect(mask).toContain('#,##') // thousands separator present
  })

  it('accounting also groups thousands', () => {
    expect(numberFormatString('accounting')).toBe('$#,##0.00')
  })

  it('number defaults to 2dp without a forced separator (Excel default)', () => {
    expect(numberFormatString('number')).toBe('0.00')
  })

  it('percentage / scientific / text / general match Excel masks', () => {
    expect(numberFormatString('percentage')).toBe('0.00%')
    expect(numberFormatString('scientific')).toBe('0.00E+00')
    expect(numberFormatString('text')).toBe('@')
    expect(numberFormatString('general')).toBe('General')
  })
})
