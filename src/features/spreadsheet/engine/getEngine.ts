/**
 * Returns the active SpreadsheetEngineAdapter based on
 * NEXT_PUBLIC_ENGINE. This is the only place that imports concrete
 * adapter classes. Callers should depend on the interface only.
 */
import { publicEnv } from '@/lib/env'
import { FortuneSheetAdapter } from '../adapters/FortuneSheetAdapter'
import { UniverAdapter } from '../adapters/UniverAdapter'
import type { SpreadsheetEngineAdapter } from './SpreadsheetEngineAdapter'

let cached: SpreadsheetEngineAdapter | null = null

export function getEngine(): SpreadsheetEngineAdapter {
  if (cached) return cached
  cached = publicEnv.NEXT_PUBLIC_ENGINE === 'univer' ? new UniverAdapter() : new FortuneSheetAdapter()
  return cached
}

/** Test-only — allows resetting the cached adapter between tests. */
export function __resetEngineForTests(): void {
  cached = null
}
