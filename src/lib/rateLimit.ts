/**
 * Simple in-memory token-bucket rate limiter for AI routes.
 *
 * For multi-instance deployments, replace this with a Supabase or Upstash
 * counter. For Vercel single-region with low concurrency it is good enough.
 */
import { serverEnv } from '@/lib/env'

interface Bucket {
  tokens: number
  lastRefillMs: number
}

const buckets = new Map<string, Bucket>()
const REFILL_INTERVAL_MS = 60_000

export function consumeToken(key: string): { ok: boolean; retryAfterMs?: number } {
  const limit = serverEnv.AI_RATE_LIMIT_PER_USER
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now }
    buckets.set(key, bucket)
  }
  // Refill in proportion to elapsed time, capped at limit.
  const elapsed = now - bucket.lastRefillMs
  if (elapsed > 0) {
    const refill = (elapsed / REFILL_INTERVAL_MS) * limit
    bucket.tokens = Math.min(limit, bucket.tokens + refill)
    bucket.lastRefillMs = now
  }
  if (bucket.tokens < 1) {
    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / limit) * REFILL_INTERVAL_MS)
    return { ok: false, retryAfterMs }
  }
  bucket.tokens -= 1
  return { ok: true }
}

export function __resetBucketsForTests(): void {
  buckets.clear()
}
