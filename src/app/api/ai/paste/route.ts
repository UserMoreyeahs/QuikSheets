import { GROQ_MODEL, groq } from '@/lib/groq'
import { enforceAiRateLimit, jsonError, readJsonBody } from '@/lib/aiRoute'

type PasteColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'boolean'

interface PasteRouteRequest {
  rawText?: string
  pastePosition?: string
}

interface PasteColumn {
  name: string
  type: PasteColumnType
  format: string
  sampleValues: string[]
}

interface PasteDetectionResponse {
  columns: PasteColumn[]
  detectedStructure: string
}

const VALID_TYPES = new Set<PasteColumnType>([
  'text',
  'number',
  'currency',
  'date',
  'email',
  'phone',
  'url',
  'boolean',
])

const SYSTEM_PROMPT = `Analyze this pasted data and return JSON with columns array.
Each column: { name, type, format, sampleValues }
Types: text, number, currency, date, email, phone, url, boolean
Return ONLY valid JSON. No markdown.`

function parseJsonObject(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/)
  return JSON.parse(match?.[0] ?? raw)
}

function validateDetection(value: unknown): PasteDetectionResponse {
  const candidate = value as Partial<PasteDetectionResponse>
  const rawColumns = Array.isArray(candidate.columns) ? candidate.columns : []

  const columns = rawColumns
    .map((column, index) => {
      const item = column as Partial<PasteColumn>
      const type = VALID_TYPES.has(item.type as PasteColumnType)
        ? (item.type as PasteColumnType)
        : 'text'

      return {
        name:
          typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : `Column ${index + 1}`,
        type,
        format:
          typeof item.format === 'string' && item.format.trim()
            ? item.format.trim()
            : type,
        sampleValues: Array.isArray(item.sampleValues)
          ? item.sampleValues.slice(0, 5).map((sample) => String(sample))
          : [],
      }
    })
    .slice(0, 26)

  return {
    columns,
    detectedStructure:
      typeof candidate.detectedStructure === 'string' && candidate.detectedStructure.trim()
        ? candidate.detectedStructure.trim()
        : 'structured pasted data',
  }
}

export async function POST(request: Request) {
  const limited = await enforceAiRateLimit(request)
  if (limited) return limited

  const body = await readJsonBody<PasteRouteRequest>(request)
  if (!body) {
    return jsonError('Invalid JSON body.', 400)
  }

  const rawText = body.rawText?.trim()
  if (!rawText) {
    return jsonError('Paste text is required.', 400)
  }

  if (!groq) {
    return jsonError(
      'AI assistance is not configured. Set GROQ_API_KEY to enable this feature.',
      503
    )
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            body.pastePosition ? `Paste position: ${body.pastePosition}` : null,
            `Raw pasted data:\n${rawText}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content?.trim()) {
      return jsonError('The AI service returned an empty paste analysis.', 502)
    }

    return Response.json(validateDetection(parseJsonObject(content)))
  } catch (error) {
    return jsonError(
      'The AI paste analysis failed.',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
