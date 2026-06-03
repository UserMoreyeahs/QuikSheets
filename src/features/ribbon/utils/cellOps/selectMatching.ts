'use client'

/**
 * Select-by-criteria helpers — walks the active sheet and selects all cells
 * matching a criterion: formulas, comments, constants, conditional formatting,
 * or validation.
 * Mirrors Excel's Home > Find & Select > Go To Special variants.
 * Extracted from cellOps.ts — Wave 4g.
 */

import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { getInstance } from './shared'

type CellTest = (cell: Record<string, unknown> | null | undefined, r: number, c: number) => boolean

function selectMatchingCells(label: string, test: CellTest): void {
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const { gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const sheet = gridSheets.find((s) => s.id === activeSheetId)
  if (!sheet) {
    toast.error('Active sheet not found')
    return
  }

  const matches: Array<{ row: number[]; column: number[] }> = []
  const data = sheet.data ?? []
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] as Record<string, unknown> | null | undefined
      if (test(cell, r, c)) matches.push({ row: [r, r], column: [c, c] })
    }
  }

  if (matches.length === 0) {
    toast.message(`No cells with ${label.toLowerCase()}`)
    return
  }

  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(matches, { id: activeSheetId })
    toast.success(`Selected ${matches.length} cell${matches.length === 1 ? '' : 's'} with ${label.toLowerCase()}`)
  } catch (e) {
    toast.error(`Could not select: ${String(e)}`)
  }
}

export function selectCellsWithFormulas(): void {
  selectMatchingCells('Formulas', (cell) => !!cell && typeof cell.f === 'string' && cell.f !== '')
}

export function selectCellsWithComments(): void {
  selectMatchingCells('Comments', (cell) => !!cell && cell.ps != null)
}

export function selectCellsWithConstants(): void {
  selectMatchingCells(
    'Constants',
    (cell) => !!cell && cell.v != null && cell.v !== '' && !cell.f,
  )
}

export function selectCellsWithCF(): void {
  // Cross-reference the active sheet's CF rules. Cells inside any rule's range qualify.
  const inst = getInstance()
  if (!inst) {
    toast.error('Grid not ready')
    return
  }
  const { activeSheetId } = useWorkbookStore.getState()
  // Lazy-import to avoid circular dependency at module load time
  type CFStore = {
    getRulesForSheet: (sheetId: string) => Array<{ range: string }>
  }
  let cfStore: CFStore | null = null
  try {
    const debugWindow = (typeof window !== 'undefined'
      ? (window as Window & { __quiksheetsDebug?: { cf: () => CFStore } })
      : null)
    cfStore = debugWindow?.__quiksheetsDebug?.cf?.() ?? null
  } catch {
    cfStore = null
  }
  if (!cfStore) {
    toast.message('Conditional formatting store not yet loaded')
    return
  }
  const rules = cfStore.getRulesForSheet(activeSheetId)
  if (rules.length === 0) {
    toast.message('No conditional formatting rules on this sheet')
    return
  }

  function colLetterToIndex(letter: string): number {
    let result = 0
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64)
    }
    return result - 1
  }

  const selections: Array<{ row: number[]; column: number[] }> = []
  for (const rule of rules) {
    const m = rule.range.toUpperCase().match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)
    if (!m) continue
    const sc = colLetterToIndex(m[1]!)
    const sr = parseInt(m[2]!, 10) - 1
    const ec = m[3] ? colLetterToIndex(m[3]) : sc
    const er = m[4] ? parseInt(m[4]!, 10) - 1 : sr
    selections.push({ row: [sr, er], column: [sc, ec] })
  }

  if (selections.length === 0) {
    toast.message('Could not parse CF ranges')
    return
  }

  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(selections, { id: activeSheetId })
    toast.success(`Selected ${selections.length} CF range${selections.length === 1 ? '' : 's'}`)
  } catch (e) {
    toast.error(`Could not select: ${String(e)}`)
  }
}

export function selectCellsWithValidation(): void {
  const { validationRules } = useSheetStore.getState()
  const keys = Object.keys(validationRules ?? {})
  if (keys.length === 0) {
    toast.message('No data validation rules')
    return
  }

  const inst = getInstance()
  if (!inst) return
  const { activeSheetId } = useWorkbookStore.getState()
  const selections: Array<{ row: number[]; column: number[] }> = keys
    .map((key) => {
      const [r, c] = key.split(':').map((s) => parseInt(s, 10))
      return Number.isFinite(r) && Number.isFinite(c)
        ? { row: [r!, r!], column: [c!, c!] }
        : null
    })
    .filter((x): x is { row: number[]; column: number[] } => x !== null)

  if (selections.length === 0) return

  try {
    ;(inst as unknown as {
      setSelection: (s: { row: number[]; column: number[] }[], opts?: { id?: string }) => void
    }).setSelection(selections, { id: activeSheetId })
    toast.success(`Selected ${selections.length} cell${selections.length === 1 ? '' : 's'} with validation`)
  } catch (e) {
    toast.error(`Could not select: ${String(e)}`)
  }
}
