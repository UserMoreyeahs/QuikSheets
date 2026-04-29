import { GROQ_MODEL, groq, isGroqConfigured } from '@/lib/groq'

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

export async function createAiTextResponse({
  systemPrompt,
  userPrompt,
  maxTokens = 600,
  temperature = 0.2,
}: AiTextResponseOptions): Promise<Response> {
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
