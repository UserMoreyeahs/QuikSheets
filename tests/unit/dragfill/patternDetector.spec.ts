import { describe, it, expect } from 'vitest'
import { detectAndFill } from '@/features/drag-fill/utils/patternDetector'

describe('patternDetector — detectAndFill', () => {
  it('fills arithmetic series (1, 2, 3 → 4, 5, 6)', () => {
    const { values, pattern } = detectAndFill([1, 2, 3], 3)
    expect(values).toEqual([4, 5, 6])
    expect(pattern).toContain('arithmetic')
  })

  it('fills arithmetic with step 5 (10, 15, 20 → 25, 30)', () => {
    const { values } = detectAndFill([10, 15, 20], 2)
    expect(values).toEqual([25, 30])
  })

  it('repeats single number (42 → 42, 42)', () => {
    const { values, pattern } = detectAndFill([42], 2)
    expect(values).toEqual([42, 42])
    expect(pattern).toBe('repeat')
  })

  it('fills month names (Jan, Feb → Mar, Apr, May)', () => {
    const { values, pattern } = detectAndFill(['Jan', 'Feb'], 3)
    expect(values).toEqual(['Mar', 'Apr', 'May'])
    expect(pattern).toBe('months')
  })

  it('wraps months around year (Nov, Dec → Jan, Feb)', () => {
    const { values } = detectAndFill(['Nov', 'Dec'], 2)
    expect(values).toEqual(['Jan', 'Feb'])
  })

  it('fills full month names (January, February → March)', () => {
    const { values, pattern } = detectAndFill(['January', 'February'], 1)
    expect(values).toEqual(['March'])
    expect(pattern).toBe('months')
  })

  it('fills day names (Mon, Tue, Wed → Thu, Fri)', () => {
    const { values, pattern } = detectAndFill(['Mon', 'Tue', 'Wed'], 2)
    expect(values).toEqual(['Thu', 'Fri'])
    expect(pattern).toBe('days')
  })

  it('fills text with trailing number (Item 1, Item 2 → Item 3, Item 4)', () => {
    const { values, pattern } = detectAndFill(['Item 1', 'Item 2'], 2)
    expect(values).toEqual(['Item 3', 'Item 4'])
    expect(pattern).toContain('text series')
  })

  it('repeats alternating pattern (A, B → A, B, A)', () => {
    const { values, pattern } = detectAndFill(['A', 'B'], 3)
    expect(values).toEqual(['A', 'B', 'A'])
    expect(pattern).toBe('repeat')
  })

  it('handles empty input gracefully', () => {
    const { values } = detectAndFill([], 5)
    expect(values).toEqual([])
  })

  it('handles null and undefined in source', () => {
    const { values } = detectAndFill([null, undefined, ''], 2)
    expect(values.length).toBe(2)
  })

  it('fills descending series (10, 8, 6 → 4, 2, 0)', () => {
    const { values } = detectAndFill([10, 8, 6], 3)
    expect(values).toEqual([4, 2, 0])
  })
})
