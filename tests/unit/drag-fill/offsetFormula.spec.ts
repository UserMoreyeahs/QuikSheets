import { describe, it, expect } from 'vitest'
import { offsetFormula } from '@/features/drag-fill/utils/offsetFormula'

/**
 * Pins the fill-handle fix: dragging a formula must propagate the FORMULA with
 * relative references shifted by the drag distance — not flatten it to a value.
 */
describe('offsetFormula', () => {
  it('shifts relative refs down by rows (the core drag-down case)', () => {
    expect(offsetFormula('P1*2', 1, 0)).toBe('P2*2')
    expect(offsetFormula('P1*2', 2, 0)).toBe('P3*2')
    expect(offsetFormula('C2*D2', 1, 0)).toBe('C3*D3')
  })

  it('shifts relative refs right by columns', () => {
    expect(offsetFormula('A1+B1', 0, 1)).toBe('B1+C1')
  })

  it('preserves absolute ($) parts', () => {
    expect(offsetFormula('$P$1*2', 1, 0)).toBe('$P$1*2')
    expect(offsetFormula('$P1*2', 1, 1)).toBe('$P2*2') // col absolute, row relative
    expect(offsetFormula('P$1*2', 1, 1)).toBe('Q$1*2') // row absolute, col relative
  })

  it('shifts refs inside functions/ranges but not function names', () => {
    expect(offsetFormula('SUM(A1:A3)', 1, 0)).toBe('SUM(A2:A4)')
    expect(offsetFormula('VLOOKUP(A1,B1:C9,2,FALSE)', 1, 0)).toBe('VLOOKUP(A2,B2:C10,2,FALSE)')
  })

  it('never shifts refs inside string literals', () => {
    expect(offsetFormula('CONCATENATE("A1 is ",A1)', 1, 0)).toBe('CONCATENATE("A1 is ",A2)')
  })

  it('returns #REF! when a shift goes off the top/left edge', () => {
    expect(offsetFormula('A1*2', -1, 0)).toBe('#REF!*2')
  })

  it('handles multi-letter columns and no-ops a zero offset', () => {
    expect(offsetFormula('Z1', 0, 1)).toBe('AA1')
    expect(offsetFormula('AA10', 0, 1)).toBe('AB10')
    expect(offsetFormula('P1*2', 0, 0)).toBe('P1*2')
  })
})
