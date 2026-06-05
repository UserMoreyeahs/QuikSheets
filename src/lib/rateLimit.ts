/**
 * Simple in-memory token-bucket rate limiter for AI routes.
 *
 * For multi-instance deployments, replace this with a Supabase or Upstash
 * counter. For Vercel single-region with low concurrency it is good enough.
 */
import { serverEnv } from '@/lib/env'
import { getServiceRoleSupabase } from '@/lib/supabase/server'

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

/**
 * Durable, cross-instance rate check backed by Supabase (migration 0015 —
 * fixed 60s window counter via the service-role-only `consume_ai_rate_token`
 * RPC). The in-memory bucket above only caps PER serverless instance; this
 * caps globally so the public AI routes can't be hammered across instances.
 *
 * Fails SAFE: when the service-role client isn't configured (local dev) or the
 * RPC errors, it falls back to the in-memory limiter — infra trouble must never
 * hard-block legitimate AI requests.
 */
export async function consumeTokenDurable(
  key: string,
): Promise<{ ok: boolean; retryAfterMs?: number }> {
  const svc = getServiceRoleSupabase()
  if (!svc) return consumeToken(key)
  const limit = serverEnv.AI_RATE_LIMIT_PER_USER
  const now = Date.now()
  const windowStart = Math.floor(now / REFILL_INTERVAL_MS) * REFILL_INTERVAL_MS
  try {
    const { data, error } = await svc.rpc('consume_ai_rate_token', {
      p_key: key,
      p_window: new Date(windowStart).toISOString(),
      p_limit: limit,
    })
    if (error) return consumeToken(key)
    if (data === true) return { ok: true }
    return { ok: false, retryAfterMs: windowStart + REFILL_INTERVAL_MS - now }
  } catch {
    return consumeToken(key)
  }
}
