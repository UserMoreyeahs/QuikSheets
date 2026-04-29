import { getSheetMatrix } from '@/lib/fortuneSheet'
import { HYPERFORMULA_CONFIG } from '@/lib/hyperformula'
import type { ValidationConfig } from '@/types/sheet.types'
import type { Cell, Sheet } from '@fortune-sheet/core'
import { HyperFormula } from 'hyperformula'

export interface ValidationContext {
  sheets?: Sheet[]
  sheet?: Sheet
  sheetIndex?: number
  row?: number
  col?: number
}

type HyperFormulaScalar = string | number | boolean | null

function normalizeFormula(formula: string): string {
  const trimmed = formula.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('=') ? trimmed : `=${trimmed}`
}

function toHyperFormulaScalar(value: unknown): HyperFormulaScalar {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value !== 'string') return String(value)

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('=')) return trimmed
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true'
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    return Number(trimmed)
  }

  return trimmed
}

function toHyperFormulaCellValue(cell: Cell | null | undefined): HyperFormulaScalar {
  if (!cell) return null
  if (cell.f) return `=${cell.f}`
  if (cell.v !== undefined && cell.v !== null) return toHyperFormulaScalar(cell.v)
  if (cell.m !== undefined && cell.m !== null) return toHyperFormulaScalar(cell.m)
  return null
}

function uniqueSheetNames(sheets: Sheet[]): string[] {
  const counts = new Map<string, number>()

  return sheets.map((sheet, index) => {
    const baseName = sheet.name?.trim() || `Sheet${index + 1}`
    const seen = counts.get(baseName) ?? 0
    counts.set(baseName, seen + 1)
    return seen === 0 ? baseName : `${baseName}_${seen + 1}`
  })
}

function buildSheetGrid(
  sheet: Sheet,
  candidate?:
    | {
        row: number
        col: number
        value: unknown
      }
    | undefined
): HyperFormulaScalar[][] {
  const matrix = getSheetMatrix(sheet)
  const rowCount = Math.max(matrix.length, candidate ? candidate.row + 1 : 0)
  const colCount = Math.max(
    matrix.reduce((max, row) => Math.max(max, row?.length ?? 0), 0),
    candidate ? candidate.col + 1 : 0
  )

  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: colCount }, (_, colIndex) => {
      if (candidate && rowIndex === candidate.row && colIndex === candidate.col) {
        return toHyperFormulaScalar(candidate.value)
      }

      return toHyperFormulaCellValue(matrix[rowIndex]?.[colIndex] ?? null)
    })
  )
}

function isFormulaResultValid(result: unknown): boolean {
  if (Array.isArray(result) || result === null || result === undefined) return false
  if (typeof result === 'object' && result !== null && 'type' in result) return false
  if (typeof result === 'boolean') return result
  if (typeof result === 'number') return result !== 0
  if (typeof result === 'string') {
    const normalized = result.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false' || normalized.startsWith('#')) return false
    return normalized.length > 0
  }

  return Boolean(result)
}

function evaluateCustomFormula(
  value: unknown,
  formula: string,
  context: ValidationContext | undefined
): boolean {
  const formulaString = normalizeFormula(formula)
  if (!formulaString) return false

  const sheets = context?.sheets?.length ? context.sheets : context?.sheet ? [context.sheet] : []
  const sheetIndex = context?.sheetIndex ?? 0
  const row = context?.row
  const col = context?.col

  if (sheets.length === 0 || row === undefined || col === undefined || !sheets[sheetIndex]) {
    return false
  }

  const sheetNames = uniqueSheetNames(sheets)
  const workbookSheets = Object.fromEntries(
    sheets.map((sheet, index) => [
      sheetNames[index]!,
      buildSheetGrid(
        sheet,
        index === sheetIndex
          ? {
              row,
              col,
              value,
            }
          : undefined
      ),
    ])
  )

  try {
    const hf = HyperFormula.buildFromSheets(workbookSheets, HYPERFORMULA_CONFIG)
    try {
      return isFormulaResultValid(hf.calculateFormula(formulaString, sheetIndex))
    } finally {
      hf.destroy()
    }
  } catch {
    return false
  }
}

export function isValidValue(
  value: unknown,
  config: ValidationConfig | undefined,
  context?: ValidationContext
): boolean {
  if (!config) return true
  if (typeof value === 'string' && value.startsWith('=')) return true

  const stringValue = value === null || value === undefined ? '' : String(value).trim()
  const { rule } = config

  switch (rule.type) {
    case 'any':
      return true
    case 'number': {
      const numericValue = Number(stringValue)
      if (stringValue === '' || Number.isNaN(numericValue)) return false
      if (rule.min !== undefined && numericValue < rule.min) return false
      if (rule.max !== undefined && numericValue > rule.max) return false
      return true
    }
    case 'text':
      if (rule.minLength !== undefined && stringValue.length < rule.minLength) return false
      if (rule.maxLength !== undefined && stringValue.length > rule.maxLength) return false
      return true
    case 'list':
      return rule.options.includes(stringValue)
    case 'date': {
      const timestamp = Date.parse(stringValue)
      if (Number.isNaN(timestamp)) return false
      if (rule.min && timestamp < Date.parse(rule.min)) return false
      if (rule.max && timestamp > Date.parse(rule.max)) return false
      return true
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)
    case 'url':
      try {
        new URL(stringValue)
        return true
      } catch {
        return false
      }
    case 'custom':
      return evaluateCustomFormula(value, rule.formula, context)
    default:
      return true
  }
}
