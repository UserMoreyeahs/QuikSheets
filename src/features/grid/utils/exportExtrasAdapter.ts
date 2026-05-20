/**
 * Adapter — convert in-app store data into the ExportExtras shape
 * consumed by exportToExcelFidelity.
 *
 * Separated from exportUtils.ts so the export utility stays free of
 * direct store imports (lets exportUtils stay tree-shakeable from
 * code that doesn't need extras, e.g. CSV-only callers).
 *
 * Three sources:
 *   - Named Ranges  ← useNamedRangesStore
 *   - Data Validation ← useSheetStore.validationRules
 *   - Conditional Formatting ← useCFStore (standard rules only)
 *
 * Visual CF rules (data_bar, color_scale, icon_set) are intentionally
 * excluded — they don't have a clean xlsx counterpart and Excel would
 * drop them on re-save anyway. They stay in cfStore and reapply on
 * the next workbook load.
 */

import type { Sheet } from '@fortune-sheet/core'
import type { SheetTab } from '@/types/sheet.types'
import type { NamedRange } from '@/features/named-ranges/namedRangesStore'
import type { CFRule } from '@/features/conditional-formatting/types'
import type {
  ExportCFRule,
  ExportDataValidation,
  ExportExtras,
  ExportNamedRange,
} from './exportUtils'
import type { ValidationConfig } from '@/types/sheet.types'

interface BuildArgs {
  sheets: Sheet[]
  sheetTabs: SheetTab[]
  namedRanges: NamedRange[]
  cfRulesByActiveSheet: Record<string, CFRule[]>
  validationRules: Record<string, ValidationConfig>
}

/**
 * Build the ExportExtras payload from the current store state.
 *
 * `validationRules` is the sheetStore map keyed by `"${sheetId}:${row}:${col}"`.
 * We collapse adjacent cells with identical validation rules into A1
 * ranges where possible for compactness — falling back to single cells.
 */
export function buildExportExtras({
  sheets,
  sheetTabs,
  namedRanges,
  cfRulesByActiveSheet,
  validationRules,
}: BuildArgs): ExportExtras {
  const sheetNameById = new Map<string, string>()
  sheetTabs.forEach((tab) => sheetNameById.set(tab.id, tab.name))
  // Fall back to sheets[].name keyed by index in case ids didn't match.
  sheets.forEach((s, i) => {
    const fallback = s.name ?? `Sheet${i + 1}`
    if (typeof s.id === 'string' && !sheetNameById.has(s.id)) {
      sheetNameById.set(s.id, fallback)
    }
  })

  return {
    namedRanges: namedRanges.map(toExportNamedRange),
    dataValidations: collapseValidations(validationRules, sheetNameById),
    conditionalFormatting: flattenCFRules(cfRulesByActiveSheet, sheetNameById),
  }
}

function toExportNamedRange(nr: NamedRange): ExportNamedRange {
  return {
    name: nr.name,
    range: nr.range,
    ...(nr.scope !== 'workbook' ? { scopeSheetName: nr.scope } : {}),
    ...(nr.comment ? { comment: nr.comment } : {}),
  }
}

/**
 * Convert sheetStore.validationRules into one ExportDataValidation
 * per cell. Future: collapse contiguous identical rules into ranges.
 */
function collapseValidations(
  rules: Record<string, ValidationConfig>,
  sheetNameById: Map<string, string>,
): ExportDataValidation[] {
  const out: ExportDataValidation[] = []
  for (const [key, rule] of Object.entries(rules)) {
    const [sheetId, rowStr, colStr] = key.split(':')
    if (!sheetId || !rowStr || !colStr) continue
    const sheetName = sheetNameById.get(sheetId)
    if (!sheetName) continue
    const row = Number(rowStr) + 1
    const col = colIndexToLetter(Number(colStr))
    const range = `${col}${row}`

    const mapped = mapValidationToExport(rule, sheetName, range)
    if (mapped) out.push(mapped)
  }
  return out
}

function mapValidationToExport(
  config: ValidationConfig,
  sheetName: string,
  range: string,
): ExportDataValidation | null {
  const errorMessage = config.errorMessage ?? undefined
  const base = { sheetName, range, ...(errorMessage ? { errorMessage } : {}) }
  const rule = config.rule
  switch (rule.type) {
    case 'list': {
      const opts = Array.isArray(rule.options) ? rule.options : []
      return { ...base, type: 'list', formula1: `"${opts.join(',')}"` }
    }
    case 'number': {
      if (rule.min !== undefined && rule.max !== undefined) {
        return {
          ...base,
          type: 'decimal',
          operator: 'between',
          formula1: String(rule.min),
          formula2: String(rule.max),
        }
      }
      return null
    }
    case 'date': {
      if (rule.min !== undefined && rule.max !== undefined) {
        return {
          ...base,
          type: 'date',
          operator: 'between',
          formula1: String(rule.min),
          formula2: String(rule.max),
        }
      }
      return null
    }
    default:
      return null
  }
}

/**
 * Flatten cfStore rules into ExportCFRule[] keyed by sheet name.
 * Maps our internal CFCondition types onto the limited Excel set;
 * unmappable rules are skipped (they survive on re-load via cfStore).
 */
function flattenCFRules(
  byActiveSheet: Record<string, CFRule[]>,
  sheetNameById: Map<string, string>,
): ExportCFRule[] {
  const out: ExportCFRule[] = []
  for (const [sheetId, rules] of Object.entries(byActiveSheet)) {
    const sheetName = sheetNameById.get(sheetId)
    if (!sheetName) continue
    for (const rule of rules) {
      // Visual rules (data_bar/color_scale/icon_set) -> skip; they
      // re-apply locally via cfStore on next load.
      if (rule.kind && rule.kind !== 'standard') continue
      const mapped = mapCFRuleToExport(rule, sheetName)
      if (mapped) out.push(mapped)
    }
  }
  return out
}

function mapCFRuleToExport(rule: CFRule, sheetName: string): ExportCFRule | null {
  const fill = stripHash(rule.format.fill)
  const color = stripHash(rule.format.color)
  const baseStyle = {
    ...(fill ? { fill } : {}),
    ...(color ? { color } : {}),
    ...(rule.format.bold ? { bold: true } : {}),
    ...(rule.format.italic ? { italic: true } : {}),
  }
  const base = { sheetName, range: rule.range, ...baseStyle }

  switch (rule.condition.type) {
    case 'cell_value': {
      const op = mapCellValueOperator(rule.condition.operator)
      if (!op) return null
      return {
        ...base,
        type: 'cellIs',
        operator: op,
        ...(rule.condition.value !== undefined ? { formula1: rule.condition.value } : {}),
        ...(rule.condition.value2 !== undefined ? { formula2: rule.condition.value2 } : {}),
      }
    }
    case 'text_contains': {
      const op = rule.condition.operator
      const value = rule.condition.value ?? ''
      if (op === 'starts_with') return { ...base, type: 'beginsWith', formula1: value }
      if (op === 'ends_with') return { ...base, type: 'endsWith', formula1: value }
      if (op === 'not_contains') return { ...base, type: 'notContainsText', formula1: value }
      return { ...base, type: 'containsText', formula1: value }
    }
    case 'duplicate_values':
      return { ...base, type: 'duplicateValues' }
    case 'unique_values':
      return { ...base, type: 'uniqueValues' }
    case 'above_average':
      return { ...base, type: 'aboveAverage' }
    case 'below_average':
      return { ...base, type: 'belowAverage' }
    case 'top_n':
    case 'bottom_n':
      return { ...base, type: 'top10', formula1: String(rule.condition.n ?? 10) }
    default:
      return null
  }
}

function mapCellValueOperator(
  op: string | undefined,
): ExportCFRule['operator'] | undefined {
  switch (op) {
    case 'equal':
      return 'equal'
    case 'greater':
      return 'greaterThan'
    case 'greater_equal':
      return 'greaterThanOrEqual'
    case 'less':
      return 'lessThan'
    case 'less_equal':
      return 'lessThanOrEqual'
    case 'between':
      return 'between'
    default:
      return undefined
  }
}

function stripHash(hex?: string): string | undefined {
  if (!hex) return undefined
  return hex.startsWith('#') ? hex.slice(1).toUpperCase() : hex.toUpperCase()
}

// Tiny duplicate of the cellAddress helper to keep this adapter
// dependency-free. The two implementations should stay in sync.
function colIndexToLetter(index: number): string {
  let result = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
