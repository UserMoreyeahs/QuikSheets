import { describe, it, expect } from 'vitest'
import { sanitizeImportedCellValue, sanitizeMatrix } from '@/lib/security/csvInjection'

describe('sanitizeImportedCellValue', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1+1', "'+1+1"],
    ['-cmd|/c calc', "'-cmd|/c calc"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['|cat', "'|cat"],
    ['%foo', "'%foo"],
    ['0x41', "'0x41"],
  ])('prefixes %s -> %s', (input, expected) => {
    expect(sanitizeImportedCellValue(input)).toBe(expected)
  })

  it('passes through safe text', () => {
    expect(sanitizeImportedCellValue('Hello world')).toBe('Hello world')
    expect(sanitizeImportedCellValue('Rahul Sharma')).toBe('Rahul Sharma')
    expect(sanitizeImportedCellValue('123')).toBe('123')
  })

  it('passes through non-string values', () => {
    expect(sanitizeImportedCellValue(42)).toBe(42)
    expect(sanitizeImportedCellValue(null)).toBe(null)
    expect(sanitizeImportedCellValue(undefined)).toBe(undefined)
    expect(sanitizeImportedCellValue(true)).toBe(true)
  })

  it('sanitizes a matrix row-by-row', () => {
    const cleaned = sanitizeMatrix([
      ['Name', 'Note'],
      ['Asha', '=cmd'],
      ['Ben', 'plain'],
    ])
    expect(cleaned).toEqual([
      ['Name', 'Note'],
      ['Asha', "'=cmd"],
      ['Ben', 'plain'],
    ])
  })
})
