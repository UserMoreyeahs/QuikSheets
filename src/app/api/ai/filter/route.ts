import { GROQ_MODEL, groq } from '@/lib/groq'
import { jsonError, readJsonBody } from '@/lib/aiRoute'

type NLFilterOperator =
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'date_this_month'
  | 'date_last_n_days'
  | 'top_n'

interface FilterRouteRequest {
  instruction?: string
  columnSchema?: unknown
  sampleData?: unknown
}

interface AIFilterRule {
  column: string
  operator: NLFilterOperator
  value: string
}

interface ColumnSummary {
  key: string
  labels: string[]
}

const VALID_OPERATORS = new Set<NLFilterOperator>([
  'equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
  'starts_with',
  'date_this_month',
  'date_last_n_days',
  'top_n',
])

const FILTER_SYSTEM_PROMPT = `Convert this natural language filter instruction to JSON.
Return ONLY JSON array of filter rules.
Each rule: { column, operator, value }
Operators: equals, contains, greater_than, less_than,
is_empty, is_not_empty, starts_with, date_this_month,
date_last_n_days, top_n
Return [] if instruction is unclear.`

function parseJsonArray(raw: string): unknown {
  const match = raw.match(/\[[\s\S]*\]/)
  return JSON.parse(match?.[0] ?? raw)
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function cleanValue(value: string): string {
  return value
    .trim()
    .replace(/^["']/, '')
    .replace(/["']$/, '')
    .replace(/[.?!]$/, '')
    .trim()
}

function summarizeColumns(columnSchema: unknown): ColumnSummary[] {
  if (!Array.isArray(columnSchema)) return []

  return columnSchema
    .map((column, index) => {
      const item = column as Record<string, unknown>
      const labels = [
        item.header,
        item.name,
        item.label,
        item.column,
        item.letter,
        `Column ${item.column ?? item.letter ?? index + 1}`,
        `${index}`,
      ]
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map((value) => String(value).trim())
        .filter(Boolean)

      const key = labels[0] ?? `Column ${index + 1}`
      return {
        key,
        labels: Array.from(new Set(labels)),
      }
    })
    .filter((column) => column.labels.length > 0)
}

function findMentionedColumn(instruction: string, columns: ColumnSummary[]): ColumnSummary | null {
  const normalizedInstruction = normalizeToken(instruction)
  const sortedColumns = [...columns].sort((left, right) => {
    const leftLength = Math.max(...left.labels.map((label) => label.length))
    const rightLength = Math.max(...right.labels.map((label) => label.length))
    return rightLength - leftLength
  })

  return (
    sortedColumns.find((column) =>
      column.labels.some((label) => {
        const normalizedLabel = normalizeToken(label)
        return normalizedLabel.length > 0 && normalizedInstruction.includes(normalizedLabel)
      })
    ) ?? null
  )
}

function getTextAfterColumn(instruction: string, column: ColumnSummary): string {
  const normalizedInstruction = normalizeToken(instruction)
  const matchedLabel = column.labels
    .map((label) => normalizeToken(label))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find((label) => normalizedInstruction.includes(label))

  if (!matchedLabel) return instruction

  const index = normalizedInstruction.indexOf(matchedLabel)
  return instruction.slice(index + matchedLabel.length).trim()
}

function deterministicFilter(instruction: string, columnSchema: unknown): AIFilterRule[] | null {
  const columns = summarizeColumns(columnSchema)
  const column = findMentionedColumn(instruction, columns)
  if (!column) return null

  const normalized = normalizeToken(instruction)
  const afterColumn = getTextAfterColumn(instruction, column)

  if (/\bnot\s+(empty|blank)\b|\b(is|are)\s+not\s+empty\b/.test(normalized)) {
    return [{ column: column.key, operator: 'is_not_empty', value: '' }]
  }

  if (/\b(empty|blank)\b/.test(normalized)) {
    return [{ column: column.key, operator: 'is_empty', value: '' }]
  }

  if (/\bthis\s+month\b/.test(normalized)) {
    return [{ column: column.key, operator: 'date_this_month', value: '' }]
  }

  const lastDaysMatch = normalized.match(/\blast\s+(\d+)\s+days?\b/)
  if (lastDaysMatch?.[1]) {
    return [{ column: column.key, operator: 'date_last_n_days', value: lastDaysMatch[1] }]
  }

  const topNMatch = normalized.match(/\btop\s+(\d+)\b/)
  if (topNMatch?.[1]) {
    return [{ column: column.key, operator: 'top_n', value: topNMatch[1] }]
  }

  const greaterMatch = afterColumn.match(/\b(?:is\s+)?(?:greater than|above|over|more than)\s+(.+)$/i)
  if (greaterMatch?.[1]) {
    return [{ column: column.key, operator: 'greater_than', value: cleanValue(greaterMatch[1]) }]
  }

  const lessMatch = afterColumn.match(/\b(?:is\s+)?(?:less than|below|under|fewer than)\s+(.+)$/i)
  if (lessMatch?.[1]) {
    return [{ column: column.key, operator: 'less_than', value: cleanValue(lessMatch[1]) }]
  }

  const containsMatch = afterColumn.match(/\bcontains?\s+(.+)$/i)
  if (containsMatch?.[1]) {
    return [{ column: column.key, operator: 'contains', value: cleanValue(containsMatch[1]) }]
  }

  const startsWithMatch = afterColumn.match(/\bstarts?\s+with\s+(.+)$/i)
  if (startsWithMatch?.[1]) {
    return [{ column: column.key, operator: 'starts_with', value: cleanValue(startsWithMatch[1]) }]
  }

  const equalsMatch = afterColumn.match(/\b(?:is|equals?|=)\s+(.+)$/i)
  if (equalsMatch?.[1]) {
    return [{ column: column.key, operator: 'equals', value: cleanValue(equalsMatch[1]) }]
  }

  return null
}

function validateFilterRules(value: unknown): AIFilterRule[] {
  if (!Array.isArray(value)) return []

  return value
    .map((rule) => {
      const item = rule as Partial<AIFilterRule>
      const operator = item.operator
      const column = typeof item.column === 'string' ? item.column.trim() : ''
      if (!column || !VALID_OPERATORS.has(operator as NLFilterOperator)) return null

      return {
        column,
        operator: operator as NLFilterOperator,
        value:
          item.value === null || item.value === undefined
            ? ''
            : String(item.value).trim(),
      }
    })
    .filter((rule): rule is AIFilterRule => rule !== null)
    .slice(0, 5)
}

function explainFilters(filters: AIFilterRule[]): string {
  if (filters.length === 0) return 'No clear filter rules detected.'

  return filters
    .map((filter) => {
      const valueText = filter.value ? ` ${filter.value}` : ''
      return `${filter.column} ${filter.operator.replaceAll('_', ' ')}${valueText}`.trim()
    })
    .join('; ')
}

export async function POST(request: Request) {
  const body = await readJsonBody<FilterRouteRequest>(request)
  if (!body) {
    return jsonError('Invalid JSON body.', 400)
  }

  const instruction = body.instruction?.trim()
  if (!instruction) {
    return Response.json({ filters: [], explanation: 'No clear filter rules detected.' })
  }

  const deterministicRules = deterministicFilter(instruction, body.columnSchema)
  if (deterministicRules) {
    return Response.json({
      filters: deterministicRules,
      explanation: explainFilters(deterministicRules),
    })
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
      max_tokens: 500,
      messages: [
        { role: 'system', content: FILTER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Instruction: ${instruction}`,
            `Column schema:\n${JSON.stringify(body.columnSchema ?? [])}`,
            `Sample data:\n${JSON.stringify(body.sampleData ?? [])}`,
          ].join('\n\n'),
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content?.trim()) {
      return jsonError('The AI service returned an empty filter response.', 502)
    }

    const filters = validateFilterRules(parseJsonArray(content))
    return Response.json({ filters, explanation: explainFilters(filters) })
  } catch (error) {
    return jsonError(
      'The AI filter request failed.',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
