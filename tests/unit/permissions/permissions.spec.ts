import { describe, it, expect } from 'vitest'
import { ForbiddenError, UnauthorizedError } from '@/lib/permissions'

describe('permission errors', () => {
  it('UnauthorizedError carries name "UnauthorizedError"', () => {
    const e = new UnauthorizedError()
    expect(e.name).toBe('UnauthorizedError')
    expect(e.message).toBe('Unauthorized')
  })

  it('ForbiddenError accepts a custom message', () => {
    const e = new ForbiddenError('Owner role required')
    expect(e.name).toBe('ForbiddenError')
    expect(e.message).toBe('Owner role required')
  })
})
