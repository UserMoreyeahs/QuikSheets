import { describe, it, expect } from 'vitest'
import { buildFieldsFromHeaders, generateSlug, inferFieldKind } from '@/features/forms/utils/formBuilder'

describe('inferFieldKind', () => {
  it.each([
    ['Email Address', 'email'],
    ['Date Joined', 'date'],
    ['Total Amount', 'currency'],
    ['Quantity', 'number'],
    ['Status', 'status'],
    ['Active', 'checkbox'],
    ['Region', 'select'],
    ['Anything else', 'text'],
    // Quiksheets MVP polish — common business headers that previously fell
    // through to 'text' and surfaced wrong inputs in public form embeds.
    ['Units', 'number'],
    ['Sales', 'number'],
    ['Profit', 'number'],
    ['Orders', 'number'],
    ['Tax', 'currency'],
    ['Discount', 'currency'],
    ['Department', 'select'],
    ['Country', 'select'],
    ['Date of Birth', 'date'],
    ['Created At', 'date'],
    ['Approved', 'checkbox'],
  ] as const)('maps %s -> %s', (label, expected) => {
    expect(inferFieldKind(label)).toBe(expected)
  })
})

describe('buildFieldsFromHeaders', () => {
  it('skips empty headers and assigns kinds', () => {
    const fields = buildFieldsFromHeaders([
      { index: 0, label: 'Name' },
      { index: 1, label: 'Email' },
      { index: 2, label: '' },
      { index: 3, label: 'Total Amount' },
    ])
    expect(fields).toHaveLength(3)
    expect(fields[0]?.kind).toBe('text')
    expect(fields[1]?.kind).toBe('email')
    expect(fields[2]?.kind).toBe('currency')
  })
})

describe('generateSlug', () => {
  it('produces lowercase, hyphenated, suffixed slugs', () => {
    const slug = generateSlug('Q1 Sales Pipeline!')
    expect(slug).toMatch(/^q1-sales-pipeline-[a-z0-9]+$/)
  })
})
