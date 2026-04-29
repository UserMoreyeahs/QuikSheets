import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// We can't simply import src/lib/env because reading process.env happens at
// module load. Instead, mirror the public flag schema and verify it parses
// representative values, ensuring the Zod transform behaves the way the rest
// of the app relies on.

const booleanFlag = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
  .optional()
  .default('false')
  .transform((v) => v === 'true' || v === '1')

describe('env boolean flag schema', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    ['', false],
    [undefined, false],
  ])('parses %s -> %s', (input, expected) => {
    expect(booleanFlag.parse(input)).toBe(expected)
  })
})
