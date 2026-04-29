import type { FilterRule } from '@/types/sheet.types'

function parseDate(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function testFilterRule(
  cellValue: string | number | boolean | null,
  rule: FilterRule
): boolean {
  const val =
    cellValue === null || cellValue === undefined
      ? ''
      : String(cellValue).trim()

  const ruleVal = rule.value.trim()

  switch (rule.operator) {
    case 'equals':
      return val.toLowerCase() === ruleVal.toLowerCase()

    case 'not_equals':
      return val.toLowerCase() !== ruleVal.toLowerCase()

    case 'contains':
      return val.toLowerCase().includes(ruleVal.toLowerCase())

    case 'not_contains':
      return !val.toLowerCase().includes(ruleVal.toLowerCase())

    case 'starts_with':
      return val.toLowerCase().startsWith(ruleVal.toLowerCase())

    case 'ends_with':
      return val.toLowerCase().endsWith(ruleVal.toLowerCase())

    case 'is_empty':
      return val === ''

    case 'is_not_empty':
      return val !== ''

    case 'greater_than': {
      const n = Number(val)
      const r = Number(ruleVal)
      return !isNaN(n) && !isNaN(r) && n > r
    }

    case 'less_than': {
      const n = Number(val)
      const r = Number(ruleVal)
      return !isNaN(n) && !isNaN(r) && n < r
    }

    case 'greater_equal': {
      const n = Number(val)
      const r = Number(ruleVal)
      return !isNaN(n) && !isNaN(r) && n >= r
    }

    case 'less_equal': {
      const n = Number(val)
      const r = Number(ruleVal)
      return !isNaN(n) && !isNaN(r) && n <= r
    }

    case 'is_between': {
      const n = Number(val)
      const r1 = Number(ruleVal)
      const r2 = Number(rule.value2 ?? '')
      return !isNaN(n) && !isNaN(r1) && !isNaN(r2) && n >= r1 && n <= r2
    }

    case 'date_this_month': {
      const date = parseDate(val)
      if (!date) return false

      const now = new Date()
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    }

    case 'date_last_n_days': {
      const date = parseDate(val)
      const days = Number(ruleVal)
      if (!date || !Number.isFinite(days) || days < 0) return false

      const now = new Date()
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - days)
      return date >= start && date <= now
    }

    case 'top_n':
      return true

    default:
      return true
  }
}

function getTopNAllowedRows(
  rows: Record<number, Record<number, string | number | null>>,
  rule: FilterRule,
  totalRows: number
): Set<number> {
  const limit = Math.max(0, Math.floor(Number(rule.value)))
  if (!Number.isFinite(limit) || limit === 0) return new Set()

  return new Set(
    Array.from({ length: totalRows }, (_, rowIndex) => {
      const rawValue = rows[rowIndex]?.[rule.columnIndex]
      const numericValue = Number(rawValue)
      return {
        rowIndex,
        value: numericValue,
        isValid: rawValue !== null && rawValue !== '' && Number.isFinite(numericValue),
      }
    })
      .filter((item) => item.isValid)
      .sort((left, right) => right.value - left.value)
      .slice(0, limit)
      .map((item) => item.rowIndex)
  )
}

export function computeHiddenRows(
  rows: Record<number, Record<number, string | number | null>>,
  filters: FilterRule[],
  totalRows: number
): number[] {
  if (filters.length === 0) return []

  const hidden: number[] = []
  const topNFilters = filters.filter((filter) => filter.operator === 'top_n')
  const topNAllowedRows = new Map<FilterRule, Set<number>>(
    topNFilters.map((filter) => [filter, getTopNAllowedRows(rows, filter, totalRows)])
  )

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const rowData = rows[rowIndex] ?? {}
    const passes = filters.every((filter) => {
      if (filter.operator === 'top_n') {
        return topNAllowedRows.get(filter)?.has(rowIndex) ?? false
      }

      return testFilterRule(rowData[filter.columnIndex] ?? null, filter)
    })
    if (!passes) hidden.push(rowIndex)
  }

  return hidden
}
