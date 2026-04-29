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

export function extractCellReferences(formula: string): string[] {
  const pattern = /\b([A-Z]+\d+)(?::([A-Z]+\d+))?\b/g
  const refs: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(formula)) !== null) {
    const start = match[1]
    const end = match[2]
    if (start) refs.push(start)
    if (end) refs.push(end)
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
