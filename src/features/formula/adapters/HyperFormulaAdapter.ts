/**
 * HyperFormula implementation of FormulaEngineAdapter.
 *
 * Only this file may import 'hyperformula'. All evaluation/validation/
 * dependency requests across the app must route through getFormulaEngine().
 *
 * Singleton pattern
 * -----------------
 * Previously each method called HyperFormula.buildFromSheets(...) then
 * .destroy() per invocation.  For callers in tight loops (live preview,
 * recalculate-on-type) this was wasteful — each call paid full parse+build
 * overhead and GC pressure.
 *
 * Now we use the long-lived singleton from getHyperFormulaInstance() (backed
 * by src/lib/hyperformula.ts).  Between calls we:
 *   1. Remove all sheets currently loaded in the singleton.
 *   2. Add the sheets from the input workbook.
 *   3. Set content and evaluate.
 *
 * We do NOT call .destroy() — the singleton stays alive for the session.
 * destroyHyperFormulaInstance() in lib/hyperformula.ts is available for
 * test teardown.
 *
 * validateFormula is the only method that still needs a temporary instance
 * because it is purely syntactic (no workbook context) and the singleton
 * may be mid-operation when validation is called from the formula bar.
 * We use HyperFormula.buildEmpty + destroy for that case only.
 */
import { HyperFormula } from 'hyperformula'
import { HYPERFORMULA_CONFIG, getHyperFormulaInstance } from '@/lib/hyperformula'
import type {
  FormulaContext,
  FormulaDependency,
  FormulaEngineAdapter,
  FormulaResult,
  FormulaStructure,
  FormulaValue,
  FormulaWorkbook,
} from '../FormulaEngineAdapter'

/**
 * Load the given workbook into the singleton instance.
 * Removes every existing sheet then adds+populates the new ones.
 * Returns the prepared HyperFormula instance.
 */
function loadWorkbookIntoSingleton(workbook: FormulaWorkbook): HyperFormula {
  const hf = getHyperFormulaInstance()

  // Remove all sheets currently in the singleton
  const existingNames = hf.getSheetNames()
  for (const name of existingNames) {
    const id = hf.getSheetId(name)
    if (id !== undefined) {
      hf.removeSheet(id)
    }
  }

  // Add + populate sheets from the workbook.
  // addSheet() returns the sheet name (string); getSheetId() gives the numeric ID
  // needed by setSheetContent.
  for (const [name, grid] of Object.entries(workbook.sheets)) {
    hf.addSheet(name)
    const sheetId = hf.getSheetId(name)
    if (sheetId === undefined) continue
    hf.setSheetContent(sheetId, grid as (string | number | boolean | null)[][])
  }

  return hf
}

export class HyperFormulaAdapter implements FormulaEngineAdapter {
  readonly name = 'hyperformula' as const

  evaluateFormula(formula: string, context: FormulaContext): FormulaResult {
    if (!formula.startsWith('=')) {
      return { ok: true, value: formula }
    }
    try {
      const hf = loadWorkbookIntoSingleton(context.workbook)
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
    }
    // No finally/destroy — singleton stays alive
  }

  validateFormula(formula: string): { ok: boolean; error?: string } {
    if (!formula.startsWith('=')) return { ok: true }
    const body = formula.slice(1).trim()
    if (body.length === 0) return { ok: false, error: 'EMPTY' }
    // Syntax-only check: build a minimal throw-away instance so we don't
    // disturb the singleton's sheet state during a live formula-bar edit.
    let hf: HyperFormula | null = null
    try {
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
    try {
      const hf = loadWorkbookIntoSingleton(workbook)
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
    }
  }

  recalculateWorkbook(workbook: FormulaWorkbook): FormulaWorkbook {
    const hf = loadWorkbookIntoSingleton(workbook)
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
