import { colIndexToLetter } from '@/lib/cellAddress'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import type { Sheet } from '@fortune-sheet/core'

export type SummaryColumnType = 'number' | 'text' | 'date' | 'empty' | 'mixed'

export interface ColumnStats {
  columnIndex: number
  header: string
  type: SummaryColumnType
  filledCount: number
  emptyCount: number
  sum?: number
  average?: number
  min?: number
  max?: number
  uniqueCount?: number
  mostCommonValue?: string
  mostCommonCount?: number
  dateMin?: string
  dateMax?: string
}

export interface RowSummaryData {
  headers: string[]
  rows: string[][]
  sampledRows: string[][]
  rowCount: number
  stats: ColumnStats[]
  startRow: number
  endRow: number
  columnCount: number
}

export interface RowSummarySelection {
  sheetIndex: number
  startRow: number
  endRow: number
}

const MAX_AI_ROWS = 500

function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const percentMultiplier = trimmed.endsWith('%') ? 0.01 : 1
  const normalized = trimmed.replace(/[$,€£₹%\s]/g, '')
  if (!normalized || normalized === '-' || normalized === '.') return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed * percentMultiplier : null
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})|([A-Za-z]{3,}\s+\d{1,2})/.test(trimmed)) {
    return null
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function inferColumnType(values: string[]): SummaryColumnType {
  const filled = values.filter((value) => value.trim() !== '')
  if (filled.length === 0) return 'empty'

  const numbers = filled.filter((value) => parseNumber(value) !== null).length
  const dates = filled.filter((value) => parseDate(value) !== null).length

  if (numbers === filled.length) return 'number'
  if (dates === filled.length) return 'date'
  if (numbers > 0 || dates > 0) return 'mixed'
  return 'text'
}

function buildColumnStats(header: string, columnIndex: number, values: string[]): ColumnStats {
  const filledValues = values.filter((value) => value.trim() !== '')
  const emptyCount = values.length - filledValues.length
  const type = inferColumnType(values)

  if (type === 'number') {
    const numbers = filledValues
      .map(parseNumber)
      .filter((value): value is number => value !== null)
    const sum = numbers.reduce((total, value) => total + value, 0)
    const min = Math.min(...numbers)
    const max = Math.max(...numbers)

    return {
      columnIndex,
      header,
      type,
      filledCount: filledValues.length,
      emptyCount,
      sum,
      ...(numbers.length > 0 ? { average: sum / numbers.length } : {}),
      ...(Number.isFinite(min) ? { min } : {}),
      ...(Number.isFinite(max) ? { max } : {}),
    }
  }

  if (type === 'date') {
    const dates = filledValues
      .map(parseDate)
      .filter((value): value is Date => value !== null)
      .sort((left, right) => left.getTime() - right.getTime())
    const firstDate = dates[0]
    const lastDate = dates.at(-1)

    return {
      columnIndex,
      header,
      type,
      filledCount: filledValues.length,
      emptyCount,
      ...(firstDate ? { dateMin: formatDate(firstDate) } : {}),
      ...(lastDate ? { dateMax: formatDate(lastDate) } : {}),
      uniqueCount: new Set(filledValues).size,
    }
  }

  const counts = new Map<string, number>()
  filledValues.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })
  const [mostCommonValue, mostCommonCount] =
    Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] ?? []

  return {
    columnIndex,
    header,
    type,
    filledCount: filledValues.length,
    emptyCount,
    uniqueCount: counts.size,
    ...(mostCommonValue !== undefined && mostCommonCount !== undefined
      ? {
          mostCommonValue,
          mostCommonCount,
        }
      : {}),
  }
}

export function sampleRowsForAI(rows: string[][]): string[][] {
  if (rows.length <= MAX_AI_ROWS) return rows

  const firstRows = rows.slice(0, 100)
  const lastRows = rows.slice(-100)
  const middleRows = rows.slice(100, -100)
  const sampledMiddle: string[][] = []

  if (middleRows.length <= 300) {
    sampledMiddle.push(...middleRows)
  } else {
    const step = middleRows.length / 300
    for (let index = 0; index < 300; index += 1) {
      const row = middleRows[Math.floor(index * step)]
      if (row) sampledMiddle.push(row)
    }
  }

  return [...firstRows, ...sampledMiddle, ...lastRows]
}

export function buildRowSummaryData(
  sheet: Sheet,
  startRow: number,
  endRow: number
): RowSummaryData {
  const matrix = getSheetMatrix(sheet)
  const normalizedStartRow = Math.max(0, Math.min(startRow, endRow))
  const normalizedEndRow = Math.max(normalizedStartRow, Math.max(startRow, endRow))
  const selectedRows = matrix.slice(normalizedStartRow, normalizedEndRow + 1)
  const inferredColumnCount = selectedRows.reduce(
    (max, row) => Math.max(max, row?.length ?? 0),
    0
  )
  const sheetColumnCount = typeof sheet.column === 'number' ? sheet.column : 0
  const columnCount = Math.max(inferredColumnCount, sheetColumnCount, 1)
  const headerRow = matrix[0] ?? []

  const headers = Array.from({ length: columnCount }, (_, columnIndex) => {
    const header = stringifyCellValue(getCellDisplayValue(headerRow[columnIndex] ?? null)).trim()
    return header || `Column ${colIndexToLetter(columnIndex)}`
  })

  const rows = selectedRows.map((row) =>
    Array.from({ length: columnCount }, (_, columnIndex) =>
      stringifyCellValue(getCellDisplayValue(row?.[columnIndex] ?? null))
    )
  )

  const stats = headers.map((header, columnIndex) =>
    buildColumnStats(
      header,
      columnIndex,
      rows.map((row) => row[columnIndex] ?? '')
    )
  )

  return {
    headers,
    rows,
    sampledRows: sampleRowsForAI(rows),
    rowCount: rows.length,
    stats,
    startRow: normalizedStartRow,
    endRow: normalizedEndRow,
    columnCount,
  }
}
