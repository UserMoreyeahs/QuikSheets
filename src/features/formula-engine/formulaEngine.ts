import type { Sheet } from '@fortune-sheet/core'
import { getFormulaEngine } from '@/features/formula/getFormulaEngine'
import type { FormulaValue, FormulaWorkbook } from '@/features/formula/FormulaEngineAdapter'

function buildFormulaWorkbook(sheetData: Sheet[], sheetIndex: number): FormulaWorkbook {
  const sheets: Record<string, FormulaValue[][]> = {}
  sheetData.forEach((sheet, idx) => {
    const name = sheet.name ?? `Sheet${idx + 1}`
    const grid: FormulaValue[][] = []
    const cells = sheet.celldata ?? []
    cells.forEach((cell) => {
      const r = cell.r
      const c = cell.c
      while (grid.length <= r) grid.push([])
      const row = grid[r]
      if (row) {
        while (row.length <= c) row.push(null)
        const v = cell.v
        if (v?.f) {
          row[c] = `=${v.f}`
        } else if (v?.v !== undefined && v.v !== null) {
          row[c] = v.v as FormulaValue
        } else {
          row[c] = null
        }
      }
    })
    sheets[name] = grid
  })

  const names = Object.keys(sheets)
  const activeSheetName = names[sheetIndex] ?? names[0] ?? 'Sheet1'
  return { sheets, activeSheetName }
}

export function evaluateCell(
  formula: string,
  sheetData: Sheet[],
  row: number,
  col: number,
  sheetIndex: number = 0
): string | number | boolean | null {
  const workbook = buildFormulaWorkbook(sheetData, sheetIndex)
  const engine = getFormulaEngine()
  const result = engine.evaluateFormula(formula, {
    workbook,
    cell: { sheetName: workbook.activeSheetName, row, col },
  })
  if (!result.ok) return result.error ? `#${result.error}!` : null
  const value = result.value
  if (value === null || value === undefined) return null
  return value
}

/**
 * Extract cell references from a formula. Supports:
 *   – plain cell refs:    A1, B12
 *   – ranges:             A1:C10
 *   – cross-sheet refs:   Sheet2!A1, 'My Sheet'!B5:D20
 *
 * The returned array preserves the original textual form (sheet prefix included
 * when present) so the caller can render highlight overlays on the right sheet.
 */
export function extractCellReferences(formula: string): string[] {
  // Optional sheet prefix:  Name!  or  'Quoted Name'!
  // Cell:                   $? COL+ $? ROW+
  // Optional range tail:    : <cell> (sheet prefix not repeated by convention)
  const pattern =
    /(?:('([^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]+\$?\d+)(?::(\$?[A-Z]+\$?\d+))?/g

  const refs: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(formula)) !== null) {
    const sheetPrefix = match[1] ? `${match[1]}!` : ''
    const start = match[3]
    const end = match[4]
    if (start) refs.push(`${sheetPrefix}${start}`)
    if (end) refs.push(`${sheetPrefix}${end}`)
  }

  return Array.from(new Set(refs))
}

export function isValidFormula(value: string): boolean {
  if (!value.startsWith('=')) return false
  const body = value.slice(1).trim()
  if (body.length === 0) return false

  const engine = getFormulaEngine()
  return engine.validateFormula(value).ok
}
