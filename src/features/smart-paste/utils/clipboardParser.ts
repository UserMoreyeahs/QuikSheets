export type ClipboardParseType = 'table' | 'csv' | 'paragraph' | 'mixed'

export interface ClipboardParseResult {
  type: ClipboardParseType
  rows: string[][]
  confidence: number
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function normalizeRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0))
}

export function parseClipboardText(text: string): ClipboardParseResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { type: 'paragraph', rows: [], confidence: 0 }
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const hasTabs = trimmed.includes('\t')
  const pipeLines = lines.filter((line) => line.includes('|'))
  const commaLines = lines.filter((line) => line.includes(','))

  if (hasTabs) {
    return {
      type: 'table',
      rows: normalizeRows(lines.map((line) => line.split('\t').map((cell) => cell.trim()))),
      confidence: 0.95,
    }
  }

  if (pipeLines.length >= Math.max(1, lines.length / 2)) {
    return {
      type: 'table',
      rows: normalizeRows(
        lines.map((line) =>
          line
            .split('|')
            .map((cell) => cell.trim())
            .filter((cell, index, arr) => cell.length > 0 || (index > 0 && index < arr.length - 1))
        )
      ),
      confidence: 0.85,
    }
  }

  if (commaLines.length >= Math.max(1, lines.length / 2)) {
    return {
      type: 'csv',
      rows: normalizeRows(lines.map(splitCsvLine)),
      confidence: 0.8,
    }
  }

  if (lines.length === 1) {
    return {
      type: 'paragraph',
      rows: [[trimmed]],
      confidence: 0.35,
    }
  }

  return {
    type: 'mixed',
    rows: lines.map((line) => [line.trim()]),
    confidence: 0.55,
  }
}
