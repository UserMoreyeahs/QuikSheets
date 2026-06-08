import { describe, it, expect } from 'vitest'
import { detectExcelDate } from '@/features/grid/utils/detectExcelDate'
import { update } from '@fortune-sheet/core'

describe('detectExcelDate — strict, day-first detection', () => {
  it('detects DD-MM-YYYY (the T003 case) with the correct serial', () => {
    const d = detectExcelDate('01-04-2026')
    expect(d).toEqual({ serial: 46113, mask: 'dd-mm-yyyy', display: '01-04-2026' })
  })

  it('detects ISO YYYY-MM-DD', () => {
    expect(detectExcelDate('2026-04-01')).toEqual({
      serial: 46113,
      mask: 'yyyy-mm-dd',
      display: '2026-04-01',
    })
  })

  it('detects DD/MM/YYYY and DD-MMM-YYYY', () => {
    expect(detectExcelDate('01/04/2026')?.mask).toBe('dd/mm/yyyy')
    expect(detectExcelDate('01/04/2026')?.serial).toBe(46113)
    expect(detectExcelDate('01-Apr-2026')).toEqual({
      serial: 46113,
      mask: 'dd-mmm-yyyy',
      display: '01-Apr-2026',
    })
  })

  it('pads single-digit day/month and reads day-first', () => {
    expect(detectExcelDate('5-3-2026')?.display).toBe('05-03-2026') // 5 Mar
  })

  it.each([
    ['31-02-2026'], // Feb 31 — not a real date
    ['04-13-2026'], // month 13 (US-style not supported; day-first only)
    ['01-04-26'], //   2-digit year
    ['12345'], //      plain number
    ['1-2'], //        partial
    ['hello'], //      text
    ['=A1+B1'], //     formula text
    [''], //           empty
    ['1.5'], //        decimal
  ])('returns null for non-date %j', (input) => {
    expect(detectExcelDate(input)).toBeNull()
  })

  // The strongest evidence: FortuneSheet's own render engine produces exactly
  // the display string we precompute, from the serial + mask we store.
  it('serial + mask render via FortuneSheet exactly as the precomputed display', () => {
    for (const input of ['01-04-2026', '2026-04-01', '01/04/2026', '01-Apr-2026']) {
      const d = detectExcelDate(input)!
      expect(d).not.toBeNull()
      expect(update(d.mask, d.serial)).toBe(d.display)
    }
  })
})
