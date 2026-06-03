/**
 * Conditional Formatting Evaluator
 *
 * Evaluates CF rules against a FortuneSheet `Sheet` object and applies
 * (or removes) cell-level style patches directly on the sheet data.
 *
 * Architecture:
 *  ┌──────────────┐   rules[]   ┌──────────────────┐  CFCellResult[]
 *  │  cfStore.ts  │ ──────────▶ │  evaluateRules() │ ──────────────▶ style patches
 *  └──────────────┘             └──────────────────┘
 *
 * Key functions:
 *  - `evaluateRules(sheet, rules)`        — Returns matching {row,col,format} pairs.
 *  - `applyRulesToSheet(sheet,rules,bak)` — Clones sheet with CF styles applied.
 *  - `stripRulesFromSheet(sheet, bak)`    — Reverts CF styles using the backup map.
 *  - `parseRange(range)`                  — Parses "A1:C10", "A:C", "1:5" → ParsedRange.
 *  - `validateRange(range)`               — Returns true when parseRange succeeds.
 *
 * Visual rules (data bars, color scales, icon sets) are delegated to
 * `visualCFEvaluator.ts` and their results are merged in `applyRulesToSheet`.
 */

import type { CFCondition, CFFormat, CFRule, CFBackupCell } from '../types'
import type { Cell, Sheet } from '@fortune-sheet/core'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import { evaluateDataBar, evaluateColorScale, evaluateIconSet } from './visualCFEvaluator'

/** Row/column bounds (0-based) for a parsed A1-notation range string. */
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

    case 'top_n_percent': {
      const pct = n ?? 10
      const nums = rangeValues.map(toNumber).filter((v): v is number => v !== null)
      if (nums.length === 0) return false
      const cutoffIdx = Math.max(1, Math.ceil(nums.length * (pct / 100)))
      const sorted = [...nums].sort((a, b) => b - a)
      const threshold = sorted[cutoffIdx - 1] ?? sorted[sorted.length - 1]
      const cellNum = toNumber(cellValue)
      return cellNum !== null && threshold !== undefined && cellNum >= threshold
    }

    case 'bottom_n_percent': {
      const pct = n ?? 10
      const nums = rangeValues.map(toNumber).filter((v): v is number => v !== null)
      if (nums.length === 0) return false
      const cutoffIdx = Math.max(1, Math.ceil(nums.length * (pct / 100)))
      const sorted = [...nums].sort((a, b) => a - b)
      const threshold = sorted[cutoffIdx - 1] ?? sorted[sorted.length - 1]
      const cellNum = toNumber(cellValue)
      return cellNum !== null && threshold !== undefined && cellNum <= threshold
    }

    case 'date_occurring': {
      const cellStr = toString(cellValue)
      if (cellStr === '') return false
      const cellDate = new Date(cellStr)
      if (isNaN(cellDate.getTime())) return false

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cellDay = new Date(cellDate)
      cellDay.setHours(0, 0, 0, 0)
      const cellTime = cellDay.getTime()

      const period = condition.datePeriod ?? 'today'

      switch (period) {
        case 'yesterday': {
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          return cellTime === yesterday.getTime()
        }
        case 'today':
          return cellTime === today.getTime()
        case 'tomorrow': {
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          return cellTime === tomorrow.getTime()
        }
        case 'last7Days': {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          return cellTime >= weekAgo.getTime() && cellTime <= today.getTime()
        }
        case 'lastWeek': {
          const dayOfWeek = today.getDay()
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          const thisMonday = new Date(today)
          thisMonday.setDate(thisMonday.getDate() - mondayOffset)
          const lastMonday = new Date(thisMonday)
          lastMonday.setDate(lastMonday.getDate() - 7)
          const lastSunday = new Date(thisMonday)
          lastSunday.setDate(lastSunday.getDate() - 1)
          return cellTime >= lastMonday.getTime() && cellTime <= lastSunday.getTime()
        }
        case 'thisWeek': {
          const dayOfWeek = today.getDay()
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          const thisMonday = new Date(today)
          thisMonday.setDate(thisMonday.getDate() - mondayOffset)
          const thisSunday = new Date(thisMonday)
          thisSunday.setDate(thisSunday.getDate() + 6)
          return cellTime >= thisMonday.getTime() && cellTime <= thisSunday.getTime()
        }
        case 'nextWeek': {
          const dayOfWeek = today.getDay()
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          const thisMonday = new Date(today)
          thisMonday.setDate(thisMonday.getDate() - mondayOffset)
          const nextMonday = new Date(thisMonday)
          nextMonday.setDate(nextMonday.getDate() + 7)
          const nextSunday = new Date(nextMonday)
          nextSunday.setDate(nextSunday.getDate() + 6)
          return cellTime >= nextMonday.getTime() && cellTime <= nextSunday.getTime()
        }
        case 'lastMonth': {
          const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
          return cellTime >= lastMonthStart.getTime() && cellTime <= lastMonthEnd.getTime()
        }
        case 'thisMonth': {
          const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
          const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          return cellTime >= thisMonthStart.getTime() && cellTime <= thisMonthEnd.getTime()
        }
        case 'nextMonth': {
          const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
          const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
          return cellTime >= nextMonthStart.getTime() && cellTime <= nextMonthEnd.getTime()
        }
        default:
          return false
      }
    }

    default:
      return false
  }
}

/** A single cell that matched a CF rule, with the format to apply. */
export interface CFCellResult {
  /** 0-based row index. */
  row: number
  /** 0-based column index. */
  col: number
  /** Formatting to apply (fill colour, text colour, bold, italic). */
  format: CFFormat
}

/**
 * Evaluate all standard CF rules against the sheet and return cells that match.
 *
 * Rules are evaluated in `priority` order (lowest number = highest priority).
 * Once a cell is matched by a higher-priority rule, lower-priority rules are
 * skipped for that cell (first-match-wins, mirroring Excel behaviour).
 *
 * Visual rules (data_bar / color_scale / icon_set) are intentionally excluded
 * here; they are handled by `applyRulesToSheet` via `visualCFEvaluator`.
 *
 * @param sheet - The FortuneSheet Sheet object to evaluate.
 * @param rules - The CF rules stored in cfStore for this sheet.
 * @returns Array of { row, col, format } for all matching cells.
 */
export function evaluateRules(sheet: Sheet, rules: CFRule[]): CFCellResult[] {
  if (rules.length === 0) return []

  // Skip visual CF rules (data_bar, color_scale, icon_set) — they are handled separately
  const standardRules = rules.filter((r) => !r.kind || r.kind === 'standard')
  if (standardRules.length === 0) return []

  const matrix = getSheetMatrix(sheet)
  const sorted = [...standardRules].sort((a, b) => a.priority - b.priority)
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

/**
 * Apply all CF rules to a sheet, returning a new cloned Sheet with styles patched.
 *
 * Single-pass implementation — the matrix is walked exactly ONCE to build the
 * final result, replacing the previous three-clone approach:
 *
 *  Old:  restoredMatrix = matrix.map(…clone…)   ← O(rows×cols)
 *        resultMatrix   = restoredMatrix.map(…clone…) ← O(rows×cols)
 *        cloneSheetWithData(…resultMatrix…)      ← O(rows×cols)   [3 total]
 *
 *  New:  Collect all cell mutations into a sparse `patchMap` keyed by "r:c".
 *        Walk only the matrix cells that actually have data (skip null slots).
 *        Build resultMatrix in a single O(rows×cols) pass that applies every
 *        mutation in one go, then call cloneSheetWithData once.   [1 total]
 *
 * Sparse iteration: the `patchMap` is populated only for cells that have a
 * backup to restore OR a new CF style to apply.  Empty cells in wide ranges
 * (e.g. A:C on a 1000-row sheet with 50 data rows) are never touched.
 *
 * @param sheet          - Original FortuneSheet Sheet object.
 * @param rules          - All CF rules for this sheet.
 * @param existingBackup - Backup map from the previous `applyRulesToSheet` call
 *                         (used to restore styles before re-applying).
 * @returns `{ sheet, backup }` — patched sheet clone and updated backup map.
 */
export function applyRulesToSheet(
  sheet: Sheet,
  rules: CFRule[],
  existingBackup: Record<string, CFBackupCell>
): { sheet: Sheet; backup: Record<string, CFBackupCell> } {
  // ── short-circuit (preserved from Wave 3a / commit 1e9bc07) ───────────────
  if (rules.length === 0 && Object.keys(existingBackup).length === 0) {
    return { sheet, backup: {} }
  }

  const matrix = getSheetMatrix(sheet)

  // ── Phase 1: Build a sparse patch map ─────────────────────────────────────
  //
  // patchMap[key] = { restore?: CFBackupCell, cf?: patchFn }
  //
  // We collect every mutation (backup-restore + new CF style) into this map
  // before touching the matrix.  The map keys are only cells that need work.

  type PatchEntry = {
    /** Style fields to restore from backup (may be absent if no backup for this cell). */
    restore?: CFBackupCell
    /** CF patch functions to apply in order (last-write wins per field — mirrors old impl). */
    patches: Array<(cell: Record<string, unknown>) => void>
  }

  const patchMap = new Map<string, PatchEntry>()

  function getOrCreate(key: string): PatchEntry {
    let entry = patchMap.get(key)
    if (!entry) {
      entry = { patches: [] }
      patchMap.set(key, entry)
    }
    return entry
  }

  // 1a. Populate restore operations from existingBackup
  for (const [key, original] of Object.entries(existingBackup)) {
    getOrCreate(key).restore = original
  }

  // 1b. Evaluate standard CF rules and collect patch functions
  const cfResults = evaluateRules(sheet, rules)
  for (const { row, col, format } of cfResults) {
    const key = `${row}:${col}`
    getOrCreate(key).patches.push((patched) => {
      if (format.fill !== undefined) patched.bg = format.fill
      if (format.color !== undefined) patched.fc = format.color
      if (format.bold !== undefined) patched.bl = format.bold ? 1 : 0
      if (format.italic !== undefined) patched.it = format.italic ? 1 : 0
    })
  }

  // 1c. Evaluate visual CF rules and collect patch functions
  const visualRules = rules.filter((r) => r.kind && r.kind !== 'standard')
  for (const rule of visualRules) {
    if (rule.kind === 'data_bar' && rule.dataBar) {
      const dbResults = evaluateDataBar(sheet, rule.range, rule.dataBar)
      for (const [key, { bg }] of dbResults) {
        getOrCreate(key).patches.push((patched) => { patched.bg = bg })
      }
    } else if (rule.kind === 'color_scale' && rule.colorScale) {
      const csResults = evaluateColorScale(sheet, rule.range, rule.colorScale)
      for (const [key, { bg }] of csResults) {
        getOrCreate(key).patches.push((patched) => { patched.bg = bg })
      }
    } else if (rule.kind === 'icon_set' && rule.iconSet) {
      const isResults = evaluateIconSet(sheet, rule.range, rule.iconSet)
      for (const [key, { icon }] of isResults) {
        getOrCreate(key).patches.push((patched) => {
          const currentM = String(patched.m ?? patched.v ?? '')
          patched.m = `${icon} ${currentM}`
        })
      }
    }
  }

  // ── Phase 2: Single-pass matrix walk ──────────────────────────────────────
  //
  // Build resultMatrix and newBackup in one O(rows×cols) sweep.
  // Only cells in patchMap are mutated; all others are shallow-copied as-is.

  const newBackup: Record<string, CFBackupCell> = {}

  // We need a shallow copy of the outer array (rows) regardless — cloneSheetWithData
  // expects a fresh matrix reference.  Inner row arrays are also shallow-copied once
  // here; individual cell objects are only cloned when they have a patch to apply.
  const resultMatrix: (Cell | null | undefined)[][] = matrix.map((row) => [...(row ?? [])])

  if (patchMap.size > 0) {
    for (const [key, entry] of patchMap) {
      const [rStr, cStr] = key.split(':')
      const r = parseInt(rStr ?? '0')
      const c = parseInt(cStr ?? '0')

      // ── 2a. Start from the original cell value ──────────────────────────
      if (!resultMatrix[r]) resultMatrix[r] = []
      const original = resultMatrix[r]![c]

      // Skip null/undefined cells that have no backup to restore and no
      // meaningful CF patch (no value means nothing visible to style).
      // This is the sparse optimisation: empty cells in a "A:C" whole-column
      // rule are never allocated.
      if (original == null && !entry.restore && entry.patches.length > 0) {
        // Cell has no data — CF patch on empty cell has no effect, skip.
        continue
      }
      if (original == null && !entry.restore) {
        continue
      }

      // ── 2b. Clone the cell so we don't mutate the original matrix ───────
      const cell: Record<string, unknown> = original != null ? { ...original } : {}

      // ── 2c. Apply backup restore ─────────────────────────────────────────
      if (entry.restore) {
        const orig = entry.restore
        if ('bg' in orig) cell.bg = orig.bg
        else delete cell.bg
        if ('fc' in orig) cell.fc = orig.fc
        else delete cell.fc
        if ('bl' in orig) cell.bl = orig.bl
        else delete cell.bl
        if ('it' in orig) cell.it = orig.it
        else delete cell.it
        if ('m' in orig) cell.m = orig.m
        else delete cell.m
      }

      // ── 2d. Record new backup (pre-patch values, after restore) ─────────
      if (entry.patches.length > 0) {
        newBackup[key] = {
          ...(cell.bg !== undefined ? { bg: cell.bg as string } : {}),
          ...(cell.fc !== undefined ? { fc: cell.fc as string } : {}),
          ...(cell.bl !== undefined ? { bl: cell.bl as 0 | 1 } : {}),
          ...(cell.it !== undefined ? { it: cell.it as 0 | 1 } : {}),
          ...(cell.m !== undefined ? { m: cell.m as string } : {}),
        }

        // ── 2e. Apply CF patches ──────────────────────────────────────────
        for (const patchFn of entry.patches) {
          patchFn(cell)
        }
      }

      resultMatrix[r]![c] = cell
    }
  }

  const nextSheet = cloneSheetWithData(sheet, resultMatrix as Cell[][])

  return { sheet: nextSheet, backup: newBackup }
}

/**
 * Restore original cell styles by reverting the CF backup map.
 * Use this when all CF rules for a sheet are deleted.
 *
 * @param sheet  - The sheet that currently has CF styles applied.
 * @param backup - The backup map produced by the last `applyRulesToSheet` call.
 * @returns A new cloned Sheet with all CF styles reverted.
 */
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
    if ('m' in original) restored.m = original.m
    else delete restored.m

    resultMatrix[r]![c] = restored
  })

  return cloneSheetWithData(sheet, resultMatrix as Cell[][])
}

/**
 * Quick sanity-check for a range string before it is stored in a CF rule.
 *
 * @param range - A1-notation string like "A1:C10", "A:C", or "1:5".
 * @returns `true` if the range can be parsed; `false` otherwise.
 */
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
