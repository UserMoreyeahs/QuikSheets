import { GROQ_MODEL, groq } from '@/lib/groq'
import { jsonError, readJsonBody } from '@/lib/aiRoute'

interface FormulaRouteRequest {
  instruction?: string
  cellAddress?: string
  sheetContext?: string
}

const FORMULA_SYSTEM_PROMPT = `You are a spreadsheet formula expert.
Generate ONLY the formula starting with =.
No explanation. No markdown. Just the formula.`

function parseCellRow(cellAddress?: string): number {
  const match = cellAddress?.match(/[A-Z]+(\d+)/i)
  return match?.[1] ? Number(match[1]) : 1
}

function getSimpleColumnAdditionFormula(
  instruction: string,
  row: number
): { formula: string; targetCell?: string; explanation: string } | null {
  const normalized = instruction.toLowerCase()
  const isAddition =
    normalized.includes('add') ||
    normalized.includes('sum') ||
    normalized.includes('plus') ||
    normalized.includes('calculate')
  const mentionsA = /\bcol(?:umn)?\s*a\b|\ba\b/.test(normalized)
  const mentionsB = /\bcol(?:umn)?\s*b\b|\bb\b/.test(normalized)
  const mentionsC = /\bcol(?:umn)?\s*c\b|\bc\b/.test(normalized)

  if (!isAddition || !mentionsA || !mentionsB || !mentionsC) {
    return null
  }

  return {
    formula: `=A${row}+B${row}`,
    targetCell: `C${row}`,
    explanation: `This formula adds the values from columns A and B in row ${row}.`,
  }
}

function cleanFormula(value: string): string {
  const firstLine = value.trim().split(/\r?\n/)[0]?.trim() ?? ''
  const withoutFence = firstLine.replace(/^```(?:excel|spreadsheet)?/i, '').replace(/```$/i, '')
  return withoutFence.startsWith('=') ? withoutFence : `=${withoutFence.replace(/^=/, '')}`
}

export async function POST(request: Request) {
  const body = await readJsonBody<FormulaRouteRequest>(request)
  if (!body) {
    return jsonError('Invalid JSON body.', 400)
  }

  const instruction = body.instruction?.trim()
  if (!instruction) {
    return jsonError('Describe what the formula should do.', 400)
  }

  if (!groq) {
    return jsonError(
      'AI assistance is not configured. Set GROQ_API_KEY to enable this feature.',
      503
    )
  }

  const userPrompt = [
    `Instruction: ${instruction}`,
    body.cellAddress ? `Active cell: ${body.cellAddress}` : null,
    `Generate the formula for the active cell row. If the active cell is C8 and the user asks to calculate columns A and B in column C, return =A8+B8, not =A1+B1.`,
    body.sheetContext ? `Sheet context:\n${body.sheetContext}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const deterministicResult = getSimpleColumnAdditionFormula(
      instruction,
      parseCellRow(body.cellAddress)
    )

    let formula = deterministicResult?.formula ?? null
    if (!formula) {
      const formulaCompletion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 120,
        messages: [
          { role: 'system', content: FORMULA_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      })

      const formulaText = formulaCompletion.choices[0]?.message?.content
      formula = cleanFormula(formulaText ?? '')
    }
    if (!formula.trim()) {
      return jsonError('The AI service returned an empty formula.', 502)
    }

    let explanation = deterministicResult?.explanation

    if (!explanation) {
      const explanationCompletion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content:
              'Explain spreadsheet formulas in plain English. One short sentence only. Do not suggest alternate formulas.',
          },
          {
            role: 'user',
            content: `Explain what this formula does: ${formula}`,
          },
        ],
      })

      explanation =
        explanationCompletion.choices[0]?.message?.content?.trim() ||
        'This formula follows the requested spreadsheet calculation.'
    }

    return Response.json({ formula, explanation, targetCell: deterministicResult?.targetCell })
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

    return jsonError(
      'The AI formula request failed.',
      500,
      details
    )
  }
}
