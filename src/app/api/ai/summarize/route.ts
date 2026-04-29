import { GROQ_MODEL, groq } from '@/lib/groq'
import { jsonError, readJsonBody } from '@/lib/aiRoute'
import type { ColumnStats } from '@/features/row-summarizer/utils/rowStats'

interface SummarizeRouteRequest {
  headers?: unknown
  rows?: unknown
  rowCount?: unknown
  stats?: unknown
}

interface SummaryResult {
  summary: string
  insights: string[]
  dataCharacterization: string
}

const SYSTEM_PROMPT = `You are a data analyst assistant for SheetForge spreadsheet application.
You will receive spreadsheet rows with column headers and pre-computed statistics.
Your job is to provide a meaningful, actionable summary of what this data represents.

Return ONLY a JSON object:
{
  "summary": "One sentence (max 200 chars) describing what these rows represent as a whole - like a data analyst briefing an executive.",
  "insights": [
    "Insight 1 - a specific, quantified observation with an emoji prefix",
    "Insight 2 - a pattern, anomaly, or notable finding",
    "Insight 3 - an actionable observation or warning"
  ]
}

Rules:
- Be specific - use numbers from the stats provided
- Insights must add value beyond what the stats already show
- Use business language, not technical jargon
- Emoji prefix for each insight: 📈 (positive trend), 📉 (negative trend), ⚠️ (warning/anomaly), 🏆 (top performer), 💡 (insight), 🔄 (pattern)
- If data is insufficient to draw insights, say so honestly
- NO markdown, NO text outside the JSON`

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isStringMatrix(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => isStringArray(row))
}

function isColumnStatsArray(value: unknown): value is ColumnStats[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') return false
      const stat = item as Record<string, unknown>
      return typeof stat.columnIndex === 'number' && typeof stat.header === 'string'
    })
  )
}

function compact(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'n/a'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    notation: Math.abs(value) >= 100000 ? 'compact' : 'standard',
  }).format(value)
}

function trimSummary(value: string): string {
  const summary = value.replace(/\s+/g, ' ').trim()
  return summary.length <= 200 ? summary : `${summary.slice(0, 197).trim()}...`
}

function buildLocalSummary(
  headers: string[],
  rows: string[][],
  rowCount: number,
  stats: ColumnStats[]
): SummaryResult {
  const numericStats = stats
    .filter((stat) => stat.type === 'number' && typeof stat.sum === 'number')
    .sort((left, right) => Math.abs(right.sum ?? 0) - Math.abs(left.sum ?? 0))
  const textStats = stats
    .filter((stat) => stat.type === 'text' && stat.mostCommonValue)
    .sort((left, right) => (right.mostCommonCount ?? 0) - (left.mostCommonCount ?? 0))
  const dateStat = stats.find((stat) => stat.type === 'date' && stat.dateMin && stat.dateMax)
  const emptiestStat = [...stats].sort((left, right) => right.emptyCount - left.emptyCount)[0]

  const topNumeric = numericStats[0]
  const topText = textStats[0]
  const datePhrase = dateStat ? ` from ${dateStat.dateMin} to ${dateStat.dateMax}` : ''
  const metricPhrase = topNumeric
    ? ` with ${topNumeric.header} totaling ${compact(topNumeric.sum)}`
    : ''
  const categoryPhrase = topText
    ? ` and "${topText.mostCommonValue}" leading ${topText.header}`
    : ''
  const summary = trimSummary(
    `These ${rowCount} rows cover ${headers.slice(0, 3).join(', ')}${datePhrase}${metricPhrase}${categoryPhrase}.`
  )

  const insights = [
    topNumeric
      ? `📈 ${topNumeric.header} totals ${compact(topNumeric.sum)} with an average of ${compact(topNumeric.average)}.`
      : `💡 ${rowCount} selected rows are ready for review, but no numeric column was detected.`,
    topText
      ? `🏆 "${topText.mostCommonValue}" is the most common ${topText.header}, appearing ${topText.mostCommonCount ?? 1} times.`
      : `🔄 The selected data has ${rows.length} sampled rows available for analysis.`,
    emptiestStat && emptiestStat.emptyCount > 0
      ? `⚠️ ${emptiestStat.header} has ${emptiestStat.emptyCount} blank values in the selection.`
      : `💡 No obvious blank-heavy column was found in the selected rows.`,
  ]

  return {
    summary,
    insights,
    dataCharacterization: `Analyzed ${rowCount} rows across ${headers.length} columns using pre-computed column statistics.`,
  }
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

function normalizeAiResult(value: unknown, fallback: SummaryResult): SummaryResult {
  if (!value || typeof value !== 'object') return fallback

  const objectValue = value as Record<string, unknown>
  const summary =
    typeof objectValue.summary === 'string' && objectValue.summary.trim()
      ? trimSummary(objectValue.summary)
      : fallback.summary
  const insights = Array.isArray(objectValue.insights)
    ? objectValue.insights
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 3)
    : []

  while (insights.length < 3) {
    insights.push(fallback.insights[insights.length] ?? '💡 Data was summarized from the selected rows.')
  }

  return {
    summary,
    insights: insights.slice(0, 3),
    dataCharacterization: fallback.dataCharacterization,
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody<SummarizeRouteRequest>(request)
  if (!body) {
    return jsonError('Invalid JSON body.', 400)
  }

  if (!isStringArray(body.headers)) {
    return jsonError('headers must be an array of strings.', 400)
  }

  if (!isStringMatrix(body.rows)) {
    return jsonError('rows must be an array of string arrays.', 400)
  }

  if (typeof body.rowCount !== 'number' || !Number.isFinite(body.rowCount)) {
    return jsonError('rowCount must be a number.', 400)
  }

  if (!isColumnStatsArray(body.stats)) {
    return jsonError('stats must be an array of column stats.', 400)
  }

  const headers = body.headers
  const rows = body.rows.slice(0, 500)
  const rowCount = Math.max(0, Math.floor(body.rowCount))
  const stats = body.stats
  const fallback = buildLocalSummary(headers, rows, rowCount, stats)

  if (!groq) {
    return Response.json(fallback)
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            headers,
            rows,
            rowCount,
            stats,
          }),
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    const parsed = typeof content === 'string' ? parseJsonObject(content) : null
    return Response.json(normalizeAiResult(parsed, fallback))
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

    return Response.json(fallback)
  }
}
