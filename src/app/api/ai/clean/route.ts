/**
 * /api/ai/clean
 * --------------------------------------------------------------------------
 * POST { values: string[], operation: 'custom', instruction?: string }
 *
 * Runs a free-form AI cleaning pass on a list of strings.  Deterministic
 * operations (trim, case, phone, date) run client-side via cleaners.ts and
 * never hit this route — the AI is only used for the `custom` operation,
 * where the user types something like "extract just the city" or
 * "normalize all currencies to USD with 2 decimals".
 */

import { GROQ_MODEL, groq } from '@/lib/groq'
import { jsonError, readJsonBody } from '@/lib/aiRoute'

interface CleanRouteRequest {
  values?: unknown
  instruction?: unknown
}

interface CleanRouteResponse {
  cleaned: string[]
  /** number of items that changed */
  changed: number
  /** Short human-friendly summary of the operation. */
  summary: string
}

const SYSTEM_PROMPT = `You are a data-cleaning assistant for the Quiksheets spreadsheet application.

You will receive a JSON object:
  { "instruction": "<plain-English cleaning instruction>",
    "values":      ["raw value 1", "raw value 2", ...] }

Apply the instruction to EACH value and return a JSON array of cleaned strings
in the same order, same length, no nulls.  Empty strings stay empty.

Output format — return EXACTLY this JSON, no markdown, no commentary:
{
  "cleaned": ["v1", "v2", ...],
  "summary": "Short past-tense sentence describing what you did, max 100 chars."
}

Rules:
- Preserve list length and order. NEVER drop or reorder items.
- If a value is already in the desired form, return it unchanged.
- If a value is genuinely unparseable, return it unchanged (do not guess).
- No markdown, no explanation, no extra keys.`

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody<CleanRouteRequest>(request)
  if (!body) return jsonError('Invalid JSON body.', 400)
  if (!isStringArray(body.values)) {
    return jsonError('values must be an array of strings.', 400)
  }
  if (typeof body.instruction !== 'string' || body.instruction.trim().length === 0) {
    return jsonError('instruction is required for custom cleaning.', 400)
  }
  if (body.values.length === 0) {
    return Response.json({ cleaned: [], changed: 0, summary: 'No values to clean.' } satisfies CleanRouteResponse)
  }
  if (body.values.length > 500) {
    return jsonError('Too many values — limit is 500 per request.', 400)
  }
  if (!groq) {
    return jsonError(
      'AI cleaning is not configured. Set GROQ_API_KEY in .env.local to enable custom cleaning.',
      503
    )
  }

  const values = body.values
  const instruction = body.instruction.trim()

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ instruction, values }) },
      ],
    })

    const content = completion.choices[0]?.message?.content
    const parsed = typeof content === 'string' ? parseJsonObject(content) : null
    if (!parsed || typeof parsed !== 'object') {
      return jsonError('AI returned an unparseable response.', 502)
    }
    const obj = parsed as Record<string, unknown>
    if (!isStringArray(obj.cleaned)) {
      return jsonError('AI response did not contain a string array under "cleaned".', 502)
    }
    if (obj.cleaned.length !== values.length) {
      return jsonError('AI response length did not match input length.', 502)
    }
    const summary = typeof obj.summary === 'string' ? obj.summary.slice(0, 120) : `Cleaned ${values.length} values.`

    let changed = 0
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== obj.cleaned[i]) changed++
    }

    return Response.json({ cleaned: obj.cleaned, changed, summary } satisfies CleanRouteResponse)
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown error'
    if (
      details.includes('401') ||
      details.toLowerCase().includes('invalid api key') ||
      details.toLowerCase().includes('expired_api_key')
    ) {
      return jsonError(
        'Groq API key is invalid or expired. Replace GROQ_API_KEY in .env.local, then restart the dev server.',
        401
      )
    }
    return jsonError('The AI cleaning request failed.', 500, details)
  }
}
