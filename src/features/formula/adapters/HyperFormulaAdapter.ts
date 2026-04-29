/**
 * HyperFormula implementation of FormulaEngineAdapter.
 *
 * Only this file may import 'hyperformula'. All evaluation/validation/
 * dependency requests across the app must route through getFormulaEngine().
 */
import { HyperFormula } from 'hyperformula'
import { HYPERFORMULA_CONFIG } from '@/lib/hyperformula'
import type {
  FormulaContext,
  FormulaDependency,
  FormulaEngineAdapter,
  FormulaResult,
  FormulaStructure,
  FormulaValue,
  FormulaWorkbook,
} from '../FormulaEngineAdapter'

function toHfSheets(workbook: FormulaWorkbook): Record<string, (FormulaValue | null)[][]> {
  return workbook.sheets
}

function buildInstance(workbook: FormulaWorkbook): HyperFormula {
  return HyperFormula.buildFromSheets(toHfSheets(workbook), HYPERFORMULA_CONFIG)
}

export class HyperFormulaAdapter implements FormulaEngineAdapter {
  readonly name = 'hyperformula' as const

  evaluateFormula(formula: string, context: FormulaContext): FormulaResult {
    if (!formula.startsWith('=')) {
      return { ok: true, value: formula }
    }
    let hf: HyperFormula | null = null
    try {
      hf = buildInstance(context.workbook)
      const sheetId = hf.getSheetId(context.cell.sheetName)
      if (sheetId === undefined) return { ok: false, error: 'Sheet not found' }
      hf.setCellContents(
        { sheet: sheetId, row: context.cell.row, col: context.cell.col },
        [[formula]]
      )
      const value = hf.getCellValue({
        sheet: sheetId,
        row: context.cell.row,
        col: context.cell.col,
      })
      if (value && typeof value === 'object' && 'type' in value) {
        return { ok: false, error: String(value.type ?? 'ERROR') }
      }
      return { ok: true, value: value as FormulaValue }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Evaluation failed' }
    } finally {
      hf?.destroy()
    }
  }

  validateFormula(formula: string): { ok: boolean; error?: string } {
    if (!formula.startsWith('=')) return { ok: true }
    const body = formula.slice(1).trim()
    if (body.length === 0) return { ok: false, error: 'EMPTY' }
    let hf: HyperFormula | null = null
    try {
      // hf.validateFormula is a syntax-only check that ignores evaluation
      // errors like CYCLE; building an empty instance is enough.
      hf = HyperFormula.buildEmpty(HYPERFORMULA_CONFIG)
      const ok = hf.validateFormula(formula)
      return ok ? { ok: true } : { ok: false, error: 'INVALID' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invalid formula' }
    } finally {
      hf?.destroy()
    }
  }

  getDependencies(cell: FormulaDependency, workbook: FormulaWorkbook): FormulaDependency[] {
    let hf: HyperFormula | null = null
    try {
      hf = buildInstance(workbook)
      const sheetId = hf.getSheetId(cell.sheetName)
      if (sheetId === undefined) return []
      const precedents = hf.getCellPrecedents({ sheet: sheetId, row: cell.row, col: cell.col })
      const deps: FormulaDependency[] = []
      for (const p of precedents) {
        if ('start' in p) {
          for (let r = p.start.row; r <= p.end.row; r++) {
            for (let c = p.start.col; c <= p.end.col; c++) {
              deps.push({ sheetName: hf.getSheetName(p.start.sheet) ?? '', row: r, col: c })
            }
          }
        } else if ('row' in p) {
          deps.push({ sheetName: hf.getSheetName(p.sheet) ?? '', row: p.row, col: p.col })
        }
      }
      return deps
    } catch {
      return []
    } finally {
      hf?.destroy()
    }
  }

  recalculateWorkbook(workbook: FormulaWorkbook): FormulaWorkbook {
    let hf: HyperFormula | null = null
    try {
      hf = buildInstance(workbook)
      const out: Record<string, FormulaValue[][]> = {}
      for (const name of Object.keys(workbook.sheets)) {
        const sheetId = hf.getSheetId(name)
        if (sheetId === undefined) continue
        const dims = hf.getSheetDimensions(sheetId)
        const grid: FormulaValue[][] = []
        for (let r = 0; r < dims.height; r++) {
          const row: FormulaValue[] = []
          for (let c = 0; c < dims.width; c++) {
            const v = hf.getCellValue({ sheet: sheetId, row: r, col: c })
            row.push(v && typeof v === 'object' ? null : (v as FormulaValue))
          }
          grid.push(row)
        }
        out[name] = grid
      }
      return { sheets: out, activeSheetName: workbook.activeSheetName }
    } finally {
      hf?.destroy()
    }
  }

  explainFormulaStructure(formula: string): FormulaStructure {
    const fnRegex = /([A-Z][A-Z0-9_.]*)\s*\(/g
    const functions = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = fnRegex.exec(formula)) !== null) {
      if (match[1]) functions.add(match[1])
    }
    return { ast: null, functions: Array.from(functions), references: [] }
  }

  getSupportedFunctions(): string[] {
    return HyperFormula.getRegisteredFunctionNames('enGB')
  }
}
