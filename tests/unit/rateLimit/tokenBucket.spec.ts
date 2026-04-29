import { describe, it, expect, beforeEach } from 'vitest'
import { consumeToken, __resetBucketsForTests } from '@/lib/rateLimit'

describe('rate limit token bucket', () => {
  beforeEach(() => {
    __resetBucketsForTests()
  })

  it('allows the first token consumption', () => {
    expect(consumeToken('user-1').ok).toBe(true)
  })

  it('eventually blocks after the configured number of consumptions', () => {
    // Default AI_RATE_LIMIT_PER_USER is 50.
    let blocked = false
    for (let i = 0; i < 200; i++) {
      const result = consumeToken('user-burst')
      if (!result.ok) {
        blocked = true
        expect(result.retryAfterMs).toBeGreaterThan(0)
        break
      }
    }
    expect(blocked).toBe(true)
  })
})
