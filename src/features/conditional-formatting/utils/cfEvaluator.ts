import type { CFCondition, CFFormat, CFRule, CFBackupCell } from '../types'
import type { Cell, Sheet } from '@fortune-sheet/core'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'

export interface ParsedRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

function colLetterToIndex(letter: string): number {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.toUpperCase().charCodeAt(i) - 64)
  }
  return result - 1
}

function colIndexToLetter(index: number): string {
  let letter = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

export function parseRange(range: string, maxRows = 1000, maxCols = 26): ParsedRange {
  const trimmed = range.trim().toUpperCase()

  // Whole-column range e.g. "A:C"
  const colOnlyMatch = trimmed.match(/^([A-Z]+):([A-Z]+)$/)
  if (colOnlyMatch) {
    return {
      startRow: 0,
      endRow: maxRows - 1,
      startCol: colLetterToIndex(colOnlyMatch[1]!),
      endCol: colLetterToIndex(colOnlyMatch[2]!),
    }
  }

  // Whole-row range e.g. "1:5"
  const rowOnlyMatch = trimmed.match(/^(\d+):(\d+)$/)
  if (rowOnlyMatch) {
    return {
      startRow: parseInt(rowOnlyMatch[1]!) - 1,
      endRow: parseInt(rowOnlyMatch[2]!) - 1,
      startCol: 0,
      endCol: maxCols - 1,
    }
  }

  // Standard range e.g. "A1:F100" or single cell "B2"
  const rangeMatch = trimmed.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)
  if (rangeMatch) {
    const startCol = colLetterToIndex(rangeMatch[1]!)
    const startRow = parseInt(rangeMatch[2]!) - 1
    const endCol = rangeMatch[3] ? colLetterToIndex(rangeMatch[3]) : startCol
    const endRow = rangeMatch[4] ? parseInt(rangeMatch[4]) - 1 : startRow
    return {
      startRow: Math.min(startRow, endRow),
      endRow: Math.max(startRow, endRow),
      startCol: Math.min(startCol, endCol),
      endCol: Math.max(startCol, endCol),
    }
  }

  // Fallback: entire sheet
  return { startRow: 0, endRow: maxRows - 1, startCol: 0, endCol: maxCols - 1 }
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function evaluateCondition(
  cellValue: unknown,
  condition: CFCondition,
  rangeValues: unknown[]
): boolean {
  const { type, operator, value, value2, n } = condition

  switch (type) {
    case 'cell_empty':
      return cellValue === null || cellValue === undefined || cellValue === ''

    case 'cell_not_empty':
      return cellValue !== null && cellValue !== undefined && cellValue !== ''

    case 'text_contains': {
      const str = toString(cellValue).toLowerCase()
      const needle = (value ?? '').toLowerCase()
      if (operator === 'not_contains') return !str.includes(needle)
      if (operator === 'starts_with') return str.startsWith(needle)
      if (operator === 'ends_with') return str.endsWith(needle)
      return str.includes(needle)
    }

    case 'cell_value': {
      const num = toNumber(cellValue)
      const ref = toNumber(value)
      const ref2 = toNumber(value2)
      const strCell = toString(cellValue).toLowerCase()
      const strRef = (value ?? '').toLowerCase()

      switch (operator) {
        case 'equal':
          return num !== null && ref !== null ? num === ref : strCell === strRef
        case 'not_equal':
          return num !== null && ref !== null ? num !== ref : strCell !== strRef
        case 'greater':
          return num !== null && ref !== null && num > ref
        case 'greater_equal':
          return num !== null && ref !== null && num >= ref
        case 'less':
          return num !== null && ref !== null && num < ref
        case 'less_equal':
          return num !== null && ref !== null && num <= ref
        case 'between':
          return num !== null && ref !== null && ref2 !== null && num >= ref && num <= ref2
        case 'not_between':
          return num !== null && ref !== null && ref2 !== null && (num < ref || num > ref2)
        default:
          return false
      }
    }

    case 'above_average': {
      const nums = rangeValues.map(toNumber).filter((v): v is number => v !== null)
      if (nums.length === 0) return false
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      const cellNum = toNumber(cellValue)
      return cellNum !== null && cellNum > avg
    }

    case 'below_average': {
      const nums = rangeValues.map(toNumber).filter((v): v is number => v !== null)
      if (nums.length === 0) return false
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      const cellNum = toNumber(cellValue)
      return cellNum !== null && cellNum < avg
    }

    case 'top_n': {
      const topN = n ?? 10
      const nums = rangeValues.map(toNumber).filter((v): v is number => v !== null)
      if (nums.length === 0) return false
      const sorted = [...nums].sort((a, b) => b - a)
      const threshold = sorted[topN - 1] ?? sorted[sorted.length - 1]
      const cellNum = toNumber(cellValue)
      return cellNum !== null && threshold !== undefined && cellNum >= threshold
    }

    case 'bottom_n': {
      const bottomN = n ?? 10
      const nums = rangeValues.map(toNumber).filter((v): v is number => v !== null)
      if (nums.length === 0) return false
      const sorted = [...nums].sort((a, b) => a - b)
      const threshold = sorted[bottomN - 1] ?? sorted[sorted.length - 1]
      const cellNum = toNumber(cellValue)
      return cellNum !== null && threshold !== undefined && cellNum <= threshold
    }

    case 'duplicate_values': {
      const strVal = toString(cellValue)
      if (strVal === '') return false
      const counts = new Map<string, number>()
      rangeValues.forEach((v) => {
        const s = toString(v)
        if (s !== '') counts.set(s, (counts.get(s) ?? 0) + 1)
      })
      return (counts.get(strVal) ?? 0) > 1
    }

    case 'unique_values': {
      const strVal = toString(cellValue)
      if (strVal === '') return false
      const counts = new Map<string, number>()
      rangeValues.forEach((v) => {
        const s = toString(v)
        if (s !== '') counts.set(s, (counts.get(s) ?? 0) + 1)
      })
      return (counts.get(strVal) ?? 0) === 1
    }

    default:
      return false
  }
}

export interface CFCellResult {
  row: number
  col: number
  format: CFFormat
}

// Returns cells that match any CF rule, with the highest-priority rule's format applied
export function evaluateRules(sheet: Sheet, rules: CFRule[]): CFCellResult[] {
  if (rules.length === 0) return []

  const matrix = getSheetMatrix(sheet)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  const resultMap = new Map<string, CFCellResult>()

  sorted.forEach((rule) => {
    const parsed = parseRange(rule.range, matrix.length, 26)
    const { startRow, endRow, startCol, endCol } = parsed

    // Collect all values in the range for aggregate conditions
    const rangeValues: unknown[] = []
    for (let r = startRow; r <= Math.min(endRow, matrix.length - 1); r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = matrix[r]?.[c]
        rangeValues.push(cell?.v ?? null)
      }
    }

    for (let r = startRow; r <= Math.min(endRow, matrix.length - 1); r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cellKey = `${r}:${c}`
        if (resultMap.has(cellKey)) continue // higher priority rule already applied

        const cell = matrix[r]?.[c]
        const cellValue = cell?.v ?? null

        if (evaluateCondition(cellValue, rule.condition, rangeValues)) {
          resultMap.set(cellKey, { row: r, col: c, format: rule.format })
        }
      }
    }
  })

  return Array.from(resultMap.values())
}

// Apply CF results to a sheet, backing up original styles
export function applyRulesToSheet(
  sheet: Sheet,
  rules: CFRule[],
  existingBackup: Record<string, CFBackupCell>
): { sheet: Sheet; backup: Record<string, CFBackupCell> } {
  const matrix = getSheetMatrix(sheet)
  const cfResults = evaluateRules(sheet, rules)
  const backup: Record<string, CFBackupCell> = { ...existingBackup }

  // Restore any previous CF-applied cells from backup before applying new rules
  const restoredMatrix = matrix.map((row) => [...(row ?? [])])
  Object.entries(backup).forEach(([key, original]) => {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0')
    const c = parseInt(cStr ?? '0')
    if (!restoredMatrix[r]) restoredMatrix[r] = []
    const existing = restoredMatrix[r]![c]
    if (!existing) return
    const restored = { ...existing }
    if ('bg' in original) restored.bg = original.bg
    else delete restored.bg
    if ('fc' in original) restored.fc = original.fc
    else delete restored.fc
    if ('bl' in original) restored.bl = original.bl
    else delete restored.bl
    if ('it' in original) restored.it = original.it
    else delete restored.it
    restoredMatrix[r]![c] = restored
  })

  // Clear backup and re-apply
  const newBackup: Record<string, CFBackupCell> = {}
  const resultMatrix = restoredMatrix.map((row) => [...(row ?? [])])

  cfResults.forEach(({ row, col, format }) => {
    if (!resultMatrix[row]) resultMatrix[row] = []
    const existing = resultMatrix[row]![col] ?? {}
    const key = `${row}:${col}`

    // Save original before applying (use conditional spread to satisfy exactOptionalPropertyTypes)
    const origBg = (existing as Record<string, unknown>).bg as string | undefined
    const origFc = (existing as Record<string, unknown>).fc as string | undefined
    const origBl = (existing as Record<string, unknown>).bl as 0 | 1 | undefined
    const origIt = (existing as Record<string, unknown>).it as 0 | 1 | undefined
    newBackup[key] = {
      ...(origBg !== undefined ? { bg: origBg } : {}),
      ...(origFc !== undefined ? { fc: origFc } : {}),
      ...(origBl !== undefined ? { bl: origBl } : {}),
      ...(origIt !== undefined ? { it: origIt } : {}),
    }

    const patched: Record<string, unknown> = { ...existing }
    if (format.fill !== undefined) patched.bg = format.fill
    if (format.color !== undefined) patched.fc = format.color
    if (format.bold !== undefined) patched.bl = format.bold ? 1 : 0
    if (format.italic !== undefined) patched.it = format.italic ? 1 : 0

    resultMatrix[row]![col] = patched
  })

  const nextSheet = cloneSheetWithData(sheet, resultMatrix as Cell[][])

  return { sheet: nextSheet, backup: newBackup }
}

// Strip CF styles from sheet (restore from backup)
export function stripRulesFromSheet(sheet: Sheet, backup: Record<string, CFBackupCell>): Sheet {
  if (Object.keys(backup).length === 0) return sheet

  const matrix = getSheetMatrix(sheet)
  const resultMatrix = matrix.map((row) => [...(row ?? [])])

  Object.entries(backup).forEach(([key, original]) => {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0')
    const c = parseInt(cStr ?? '0')
    if (!resultMatrix[r]) return
    const existing = resultMatrix[r]![c]
    if (!existing) return
    const restored = { ...existing } as Record<string, unknown>

    if ('bg' in original) restored.bg = original.bg
    else delete restored.bg
    if ('fc' in original) restored.fc = original.fc
    else delete restored.fc
    if ('bl' in original) restored.bl = original.bl
    else delete restored.bl
    if ('it' in original) restored.it = original.it
    else delete restored.it

    resultMatrix[r]![c] = restored
  })

  return cloneSheetWithData(sheet, resultMatrix as Cell[][])
}

// Validate that a range string is parseable
export function validateRange(range: string): boolean {
  if (!range.trim()) return false
  try {
    parseRange(range)
    return true
  } catch {
    return false
  }
}

export { colIndexToLetter }
