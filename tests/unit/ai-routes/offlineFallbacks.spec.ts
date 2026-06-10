import { describe, it, expect, vi } from 'vitest'

/**
 * Pins the no-GROQ-key behavior of the AI routes:
 *  - /api/ai/explain serves its deterministic fallbackExplanation at 200
 *    (T016 fix — it used to 503 even though the fallback existed).
 *  - /api/ai/formula runs the deterministic column-addition template BEFORE
 *    the no-key guard (it used to 503 before the template could run), and
 *    503s only for instructions the template can't handle.
 */

vi.mock('@/lib/groq', () => ({
  groq: null,
  GROQ_MODEL: 'test-model',
  isGroqConfigured: () => false,
}))

// enforceAiRateLimit touches next/headers cookies — stub it; keep the tiny
// helpers real-equivalent.
vi.mock('@/lib/aiRoute', () => ({
  enforceAiRateLimit: async () => null,
  jsonError: (message: string, status: number, details?: string) =>
    Response.json(details ? { error: message, details } : { error: message }, { status }),
  readJsonBody: async <T,>(request: Request): Promise<T | null> => {
    try {
      return (await request.json()) as T
    } catch {
      return null
    }
  },
}))

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/ai/explain without GROQ_API_KEY', () => {
  it('returns 200 with the deterministic fallback (not 503)', async () => {
    const { POST } = await import('@/app/api/ai/explain/route')
    const res = await POST(post('http://test/api/ai/explain', { formula: '=SUM(B2:B10)' }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { explanation: string; dependencies: string[]; sensitivityNote: string }
    expect(json.explanation).toContain('B2:B10')
    expect(json.dependencies).toContain('B2:B10')
    expect(json.sensitivityNote.length).toBeGreaterThan(0)
  })
})

describe('/api/ai/formula without GROQ_API_KEY', () => {
  it('serves the deterministic A+B template offline (row from the active cell)', async () => {
    const { POST } = await import('@/app/api/ai/formula/route')
    const res = await POST(
      post('http://test/api/ai/formula', {
        instruction: 'add columns A and B into C',
        cellAddress: 'C8',
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { formula: string; targetCell?: string }
    expect(json.formula).toBe('=A8+B8')
    expect(json.targetCell).toBe('C8')
  })

  it('503s for instructions the deterministic template cannot handle', async () => {
    const { POST } = await import('@/app/api/ai/formula/route')
    const res = await POST(
      post('http://test/api/ai/formula', {
        instruction: 'Calculate 18% GST for Amount',
        cellAddress: 'C2',
      }),
    )
    expect(res.status).toBe(503)
  })
})
