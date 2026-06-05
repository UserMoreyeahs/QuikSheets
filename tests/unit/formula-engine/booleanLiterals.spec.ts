import { describe, it, expect } from 'vitest'
import { normalizeBooleanLiterals } from '@/lib/formulaParserPatches'

/**
 * Pins the P0 fix: bare TRUE/FALSE literals (e.g. VLOOKUP(...,FALSE)) used to
 * evaluate to #NAME?. We normalise them to the function forms TRUE()/FALSE()
 * which the parser evaluates correctly.
 */
describe('normalizeBooleanLiterals', () => {
  it('rewrites a bare FALSE argument (the VLOOKUP exact-match case)', () => {
    expect(normalizeBooleanLiterals('VLOOKUP("West",A2:E11,3,FALSE)')).toBe(
      'VLOOKUP("West",A2:E11,3,FALSE())',
    )
  })

  it('rewrites bare TRUE/FALSE anywhere outside strings', () => {
    expect(normalizeBooleanLiterals('TRUE')).toBe('TRUE()')
    expect(normalizeBooleanLiterals('FALSE')).toBe('FALSE()')
    expect(normalizeBooleanLiterals('IF(A1=TRUE,1,0)')).toBe('IF(A1=TRUE(),1,0)')
  })

  it('is case-insensitive and normalises to uppercase function form', () => {
    expect(normalizeBooleanLiterals('false')).toBe('FALSE()')
    expect(normalizeBooleanLiterals('True')).toBe('TRUE()')
  })

  it('leaves existing TRUE()/FALSE() calls untouched', () => {
    expect(normalizeBooleanLiterals('TRUE()')).toBe('TRUE()')
    expect(normalizeBooleanLiterals('OR(TRUE(),FALSE())')).toBe('OR(TRUE(),FALSE())')
  })

  it('never rewrites TRUE/FALSE inside string literals', () => {
    expect(normalizeBooleanLiterals('"FALSE"')).toBe('"FALSE"')
    expect(normalizeBooleanLiterals('IF(A1,"TRUE","FALSE")')).toBe('IF(A1,"TRUE","FALSE")')
    expect(normalizeBooleanLiterals('CONCATENATE("is TRUE ",B1)')).toBe(
      'CONCATENATE("is TRUE ",B1)',
    )
  })

  it('handles escaped "" quotes inside strings', () => {
    expect(normalizeBooleanLiterals('"a ""FALSE"" b"')).toBe('"a ""FALSE"" b"')
  })

  it('respects word boundaries (no substring matches)', () => {
    expect(normalizeBooleanLiterals('TRUENORTH')).toBe('TRUENORTH')
    expect(normalizeBooleanLiterals('MYFALSE+FALSEHOOD')).toBe('MYFALSE+FALSEHOOD')
  })

  it('returns boolean-free expressions unchanged', () => {
    expect(normalizeBooleanLiterals('SUM(A1:A10)')).toBe('SUM(A1:A10)')
    expect(normalizeBooleanLiterals('')).toBe('')
  })
})
