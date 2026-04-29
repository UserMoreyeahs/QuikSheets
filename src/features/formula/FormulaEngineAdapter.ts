/**
 * FormulaEngineAdapter — only allowed boundary between Quiksheets and a
 * concrete formula engine (HyperFormula today, Univer formula next).
 *
 * Defined per docs/03_ARCHITECTURE.md §4.2.
 */

export type FormulaValue = string | number | boolean | null

export interface FormulaWorkbook {
  /** Map of sheet name -> 2D row-major matrix of values. Cells starting with '=' are formulas. */
  sheets: Record<string, FormulaValue[][]>
  activeSheetName: string
}

export interface FormulaContext {
  workbook: FormulaWorkbook
  cell: { sheetName: string; row: number; col: number }
}

export interface FormulaResult {
  ok: boolean
  value?: FormulaValue
  error?: string
}

export interface FormulaDependency {
  sheetName: string
  row: number
  col: number
}

export interface FormulaStructure {
  ast: unknown
  functions: string[]
  references: FormulaDependency[]
}

export interface FormulaEngineAdapter {
  readonly name: 'hyperformula' | 'univer'
  evaluateFormula(formula: string, context: FormulaContext): FormulaResult
  validateFormula(formula: string): { ok: boolean; error?: string }
  getDependencies(cell: FormulaDependency, workbook: FormulaWorkbook): FormulaDependency[]
  recalculateWorkbook(workbook: FormulaWorkbook): FormulaWorkbook
  explainFormulaStructure(formula: string): FormulaStructure
  getSupportedFunctions(): string[]
}
