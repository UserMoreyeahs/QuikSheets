/**
 * POST /api/ai/flash-fill
 *
 * Excel's Flash Fill: given a few user-typed example transformations
 * of a source column, infer the pattern and apply it to the remaining
 * rows. Examples of patterns the AI handles well:
 *
 *   - Extract first name from "John Smith" → "John"
 *   - Format phone "9876543210" → "+91 98765 43210"
 *   - Combine "John" + "Smith" → "John Smith"
 *   - Capitalise / lowercase / title case
 *   - Extract domain from email
 *   - Strip currency symbols and parse to number
 *
 * Request shape:
 *   {
 *     source: string[][]   // 2D array of source data (1+ columns)
 *     examples: string[]   // user-typed example outputs, same length as source rows
 *                          // empty/null entries mean "AI should fill"
 *   }
 *
 * Response:
 *   {
 *     values: string[]     // full output column, including original examples
 *                          // (caller decides which cells to overwrite)
 *     pattern?: string     // brief description of the detected pattern
 *   }
 *
 * Rate-limited via shared enforceAiRateLimit. Falls back to a 503 when
 * the Groq API key is absent rather than crashing.
 */

import { GROQ_MODEL, groq } from '@/lib/groq'
import { enforceAiRateLimit, jsonError, readJsonBody } from '@/lib/aiRoute'

interface FlashFillRequest {
  source?: unknown
  examples?: unknown
}

interface FlashFillResponse {
  values: string[]
  pattern?: string
}

const SYSTEM_PROMPT = `You are a spreadsheet Flash Fill engine. The user has provided source data and a few example outputs showing the transformation pattern they want. Your job is to infer the pattern and return values for ALL rows (including the example rows so the caller can verify).

CRITICAL:
- Output ONLY a JSON array of strings. No prose, no markdown, no code fences.
- The array length must equal the source row count exactly.
- For rows where the user provided an example, echo back the example value verbatim (don't "fix" them).
- For empty / null examples, infer the value from the pattern.
- If the pattern is unclear, do your best — never refuse. Return an empty string for rows you genuinely can't transform.`

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' || x === null || x === undefined)
}

function isMatrix(v: unknown): v is unknown[][] {
  return Array.isArray(v) && v.every((row) => Array.isArray(row))
}

export async function POST(request: Request) {
  // Per-user / IP rate limit — Flash Fill can be expensive on big sheets.
  const limited = await enforceAiRateLimit(request)
  if (limited) return limited

  const body = await readJsonBody<FlashFillRequest>(request)
  if (!body) return jsonError('Invalid JSON body.', 400)

  if (!isMatrix(body.source)) {
    return jsonError('`source` must be a 2D array of strings (rows × columns).', 400)
  }
  if (!isStringArray(body.examples)) {
    return jsonError('`examples` must be an array of strings (use empty string for unknown).', 400)
  }
  if (body.source.length === 0) {
    return jsonError('`source` cannot be empty.', 400)
  }
  if (body.source.length !== body.examples.length) {
    return jsonError(
      `Length mismatch: source has ${body.source.length} rows, examples has ${body.examples.length}.`,
      400,
    )
  }
  if (body.source.length > 200) {
    return jsonError('Flash Fill currently supports up to 200 rows per call.', 400)
  }

  if (!groq) {
    return jsonError(
      'AI assistance is not configured. Set GROQ_API_KEY to enable Flash Fill.',
      503,
    )
  }

  // Build a compact prompt. Numbered rows make it easier for the model
  // to track positions; using "→" as the separator is unambiguous.
  // TS narrowing doesn't carry the isStringArray guard past the
  // unrelated isMatrix check earlier — alias to a local to make the
  // narrowing explicit for the closure below.
  const examplesArr: string[] = body.examples
  const rows = body.source.map((row, i) => {
    const src = (row as unknown[]).map((c) => (c == null ? '' : String(c))).join(' | ')
    const ex = examplesArr[i] ?? ''
    return `${i + 1}. ${src}  →  ${ex || '?'}`
  })

  const userPrompt = [
    'Source rows (left of arrow) and example outputs (right of arrow):',
    rows.join('\n'),
    '',
    `Return a JSON array of exactly ${body.source.length} strings, one per row.`,
  ].join('\n')

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.05,
      max_tokens: Math.min(2048, body.source.length * 80),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    // Strip any accidental code fences the model might emit despite the
    // system prompt forbidding them.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return jsonError('Flash Fill model returned malformed JSON.', 502, cleaned.slice(0, 200))
    }
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'string')) {
      return jsonError('Flash Fill model returned wrong shape.', 502, JSON.stringify(parsed).slice(0, 200))
    }
    if (parsed.length !== body.source.length) {
      return jsonError(
        `Flash Fill model returned ${parsed.length} values, expected ${body.source.length}.`,
        502,
      )
    }

    const response: FlashFillResponse = { values: parsed }
    return Response.json(response)
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown error'
    if (details.includes('401') || details.toLowerCase().includes('expired_api_key')) {
      return jsonError(
        'Groq API key is invalid or expired. Replace GROQ_API_KEY in .env.local then restart the dev server.',
        401,
      )
    }
    return jsonError('Flash Fill request failed.', 500, details)
  }
}
