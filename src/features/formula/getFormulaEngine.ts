/**
 * Returns the active FormulaEngineAdapter. Today: HyperFormula. When the
 * Univer formula engine adapter is implemented, swap behind the same
 * factory.
 */
import { HyperFormulaAdapter } from './adapters/HyperFormulaAdapter'
import type { FormulaEngineAdapter } from './FormulaEngineAdapter'

let cached: FormulaEngineAdapter | null = null

export function getFormulaEngine(): FormulaEngineAdapter {
  if (!cached) cached = new HyperFormulaAdapter()
  return cached
}

/** Test-only — allows resetting the cached adapter between tests. */
export function __resetFormulaEngineForTests(): void {
  cached = null
}
