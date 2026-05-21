import { GROQ_MODEL, groq, isGroqConfigured } from '@/lib/groq'
import { consumeToken } from '@/lib/rateLimit'
import { getServerSupabase } from '@/lib/supabase/server'

interface AiTextResponseOptions {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
}

export function jsonError(message: string, status: number, details?: string): Response {
  return Response.json(details ? { error: message, details } : { error: message }, { status })
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

/**
 * Derive a stable rate-limit bucket key from a request.
 *
 * Order of preference:
 *   1. Authenticated Supabase user id (most accurate)
 *   2. X-Forwarded-For first hop (IP behind Vercel / proxy)
 *   3. CF-Connecting-IP (Cloudflare)
 *   4. Fallback "anon" (shared bucket — best we can do)
 *
 * The Supabase user check is best-effort: if the session cookie is invalid,
 * we silently fall through to IP-based limiting. Failure here must never
 * block the AI request; it only changes how the bucket is keyed.
 */
async function getRateLimitKey(request: Request): Promise<string> {
  try {
    const supabase = await getServerSupabase()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) return `user:${data.user.id}`
    }
  } catch {
    // Falls through to IP-based limiting
  }
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return `ip:${xff.split(',')[0]?.trim() ?? 'anon'}`
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return `ip:${cf}`
  return 'anon'
}

/**
 * Enforce per-user/IP rate limit on an AI route.
 *
 * Returns a 429 Response on quota exceeded (caller should `return` it).
 * Returns `null` on success — caller proceeds with normal handling.
 *
 * Standard usage at the top of an AI route handler:
 *
 *   const limited = await enforceAiRateLimit(request)
 *   if (limited) return limited
 *
 * Bucket size is governed by `AI_RATE_LIMIT_PER_USER` env var
 * (see src/lib/env.ts) — refills over a 60s window.
 */
export async function enforceAiRateLimit(request: Request): Promise<Response | null> {
  const key = await getRateLimitKey(request)
  const result = consumeToken(key)
  if (result.ok) return null
  const retrySec = Math.ceil((result.retryAfterMs ?? 60_000) / 1000)
  return new Response(
    JSON.stringify({
      error: 'AI request rate limit exceeded. Please slow down and try again shortly.',
      retryAfter: retrySec,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retrySec),
      },
    },
  )
}

export async function createAiTextResponse({
  systemPrompt,
  userPrompt,
  maxTokens = 600,
  temperature = 0.2,
  request,
}: AiTextResponseOptions & { request?: Request }): Promise<Response> {
  if (request) {
    const limited = await enforceAiRateLimit(request)
    if (limited) return limited
  }
  if (!isGroqConfigured || !groq) {
    return jsonError(
      'AI assistance is not configured. Set GROQ_API_KEY to enable this feature.',
      503
    )
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (typeof content !== 'string' || content.trim().length === 0) {
      return jsonError('The AI service returned an empty response.', 502)
    }

    return Response.json({ result: content.trim() })
  } catch (error) {
    return jsonError(
      'The AI request failed.',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
