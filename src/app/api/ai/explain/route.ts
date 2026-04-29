import { GROQ_MODEL, groq } from '@/lib/groq'
import { jsonError, readJsonBody } from '@/lib/aiRoute'
import { parseFormulaReferences } from '@/features/formula-explainer/utils/formulaParser'

interface ExplainRouteRequest {
  formula?: string
  referencedValues?: Record<string, string | number | boolean | null>
}

interface ExplainPayload {
  explanation: string
  dependencies: string[]
  sensitivityNote: string
}

const SYSTEM_PROMPT = `Explain this spreadsheet formula in plain English.
Be concise. 2-3 sentences max. No technical jargon.`

function fallbackExplanation(formula: string, dependencies: string[]): ExplainPayload {
  return {
    explanation: `This formula uses ${dependencies.length > 0 ? dependencies.join(', ') : 'the referenced cells'} to calculate a result.`,
    dependencies,
    sensitivityNote: 'Changing any referenced value can change the formula result.',
  }
}

function parseJsonPayload(raw: string, formula: string, dependencies: string[]): ExplainPayload {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as Partial<ExplainPayload>
    return {
      explanation:
        typeof parsed.explanation === 'string' && parsed.explanation.trim()
          ? parsed.explanation.trim()
          : fallbackExplanation(formula, dependencies).explanation,
      dependencies:
        Array.isArray(parsed.dependencies) && parsed.dependencies.length > 0
          ? parsed.dependencies.filter((item): item is string => typeof item === 'string')
          : dependencies,
      sensitivityNote:
        typeof parsed.sensitivityNote === 'string' && parsed.sensitivityNote.trim()
          ? parsed.sensitivityNote.trim()
          : fallbackExplanation(formula, dependencies).sensitivityNote,
    }
  } catch {
    return {
      ...fallbackExplanation(formula, dependencies),
      explanation: raw.trim() || fallbackExplanation(formula, dependencies).explanation,
    }
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody<ExplainRouteRequest>(request)
  if (!body) {
    return jsonError('Invalid JSON body.', 400)
  }

  const formula = body.formula?.trim()
  if (!formula) {
    return jsonError('A formula is required for explanation.', 400)
  }

  const dependencies = parseFormulaReferences(formula)

  if (!groq) {
    return jsonError(
      'AI assistance is not configured. Set GROQ_API_KEY to enable this feature.',
      503
    )
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 260,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Formula: ${formula}`,
            `Referenced values: ${JSON.stringify(body.referencedValues ?? {})}`,
            `Known dependencies: ${dependencies.join(', ') || 'none'}`,
            'Return only valid JSON with keys: explanation, dependencies, sensitivityNote.',
          ].join('\n'),
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content?.trim()) {
      return jsonError('The AI service returned an empty explanation.', 502)
    }

    return Response.json(parseJsonPayload(content, formula, dependencies))
  } catch (error) {
    return jsonError(
      'The AI explanation request failed.',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
