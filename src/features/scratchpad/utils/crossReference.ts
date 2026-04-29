import type { CellMatrix, Sheet } from '@fortune-sheet/core'
import { fromCellNotation } from '@/lib/cellAddress'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'

export interface CrossReferenceResult {
  isCrossRef: boolean
  cellAddress: string | null
}

export type ResolvedReferenceValue = string | number | boolean | null

const MAIN_REFERENCE_PATTERN = /^=?MAIN!([A-Z]+[1-9][0-9]*)$/i

function getMainSheetMatrix(mainSheetData: Sheet | CellMatrix | null | undefined): CellMatrix {
  if (!mainSheetData) return []
  if (Array.isArray(mainSheetData)) return mainSheetData
  return getSheetMatrix(mainSheetData)
}

export function parseCrossReference(formula: string): CrossReferenceResult {
  const match = formula.trim().match(MAIN_REFERENCE_PATTERN)

  return {
    isCrossRef: Boolean(match),
    cellAddress: match?.[1]?.toUpperCase() ?? null,
  }
}

export function resolveReference(
  cellAddress: string,
  mainSheetData: Sheet | CellMatrix | null | undefined
): ResolvedReferenceValue {
  try {
    const { row, col } = fromCellNotation(cellAddress.toUpperCase())
    const matrix = getMainSheetMatrix(mainSheetData)
    return getCellDisplayValue(matrix[row]?.[col] ?? null)
  } catch {
    return null
  }
}

export function resolveCrossReferenceFormula(
  formula: string,
  mainSheetData: Sheet | CellMatrix | null | undefined
): ResolvedReferenceValue | undefined {
  const parsed = parseCrossReference(formula)
  if (!parsed.isCrossRef || !parsed.cellAddress) return undefined

  return resolveReference(parsed.cellAddress, mainSheetData)
}
