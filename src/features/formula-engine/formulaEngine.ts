import { getHyperFormulaInstance } from '@/lib/hyperformula'
import type { Sheet } from '@fortune-sheet/core'

export function evaluateCell(
  formula: string,
  sheetData: Sheet[],
  row: number,
  col: number,
  sheetIndex: number = 0
): string | number | boolean | null {
  const hf = getHyperFormulaInstance()

  try {
    const sheets: Record<string, (string | number | boolean | null)[][]> = {}
    sheetData.forEach((sheet, idx) => {
      const name = sheet.name ?? `Sheet${idx + 1}`
      const grid: (string | number | boolean | null)[][] = []
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
            row[c] = v.v as string | number | boolean
          } else {
            row[c] = null
          }
        }
      })
      sheets[name] = grid
    })

    const sheetNames = Object.keys(sheets)
    const activeSheetName = sheetNames[sheetIndex] ?? sheetNames[0] ?? 'Sheet1'

    if (hf.countSheets() === 0) {
      hf.addSheet(activeSheetName)
    }

    const tempSheetName = `__eval_${Date.now()}`
    hf.addSheet(tempSheetName)
    const tempSheetId = hf.getSheetId(tempSheetName)
    if (tempSheetId === undefined) return null

    const cellAddress = { sheet: tempSheetId, row, col }
    hf.setCellContents(cellAddress, [[formula]])

    const result = hf.getCellValue(cellAddress)
    hf.removeSheet(tempSheetId)

    if (result === null || result === undefined) return null
    if (typeof result === 'object' && 'type' in result) {
      return `#${result.type}!`
    }
    return result as string | number | boolean
  } catch {
    return null
  }
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

  const hf = getHyperFormulaInstance()
  try {
    return hf.validateFormula(value)
  } catch {
    return false
  }
}
