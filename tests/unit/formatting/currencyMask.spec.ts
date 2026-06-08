import { describe, it, expect } from 'vitest'
import { update } from '@fortune-sheet/core'

/**
 * Real-engine pin for the ₹ currency fix (src/features/ribbon/components/
 * AccountingDropdown.tsx). FortuneSheet renders a cell's display `m` by running
 * its `ct.fa` mask through this `update` (its bundled SSF). The old Indian
 * lakh-grouped mask THREW (leaving the cell unformatted + an error toast); the
 * Western-grouped mask we now ship renders correctly. Tested against the real
 * engine, not a standalone ssf package (whose version rejects ₹ entirely).
 */
describe('FortuneSheet currency mask rendering (real SSF engine)', () => {
  it('renders the ₹ mask we ship → ₹12,000.00', () => {
    expect(update('₹#,##0.00', 12000)).toBe('₹12,000.00')
  })

  it('renders the full shipped INR mask (with [Red] negative section)', () => {
    expect(update('₹#,##0.00;[Red]-₹#,##0.00', 12000)).toContain('₹12,000.00')
  })

  it('THROWS on the old Indian lakh-grouped mask — the reason we switched', () => {
    expect(() => update('₹#,##,##0.00', 12000)).toThrow()
  })

  it('renders USD / EUR / GBP with Western grouping', () => {
    expect(update('$#,##0.00', 12000)).toBe('$12,000.00')
    expect(update('€#,##0.00', 12000)).toBe('€12,000.00')
    expect(update('£#,##0.00', 12000)).toBe('£12,000.00')
  })
})
