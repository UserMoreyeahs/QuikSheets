'use client'

import { useEffect, useMemo, useState } from 'react'
import { HyperFormula } from 'hyperformula'
import { HYPERFORMULA_CONFIG } from '@/lib/hyperformula'
import { getCellDisplayValue } from '@/lib/fortuneSheet'
import { extractCellReferences } from '@/features/formula-engine'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { Sheet } from '@fortune-sheet/core'

export interface LivePreviewResult {
  previewValue: string | number | boolean | null
  references: string[]
  isValid: boolean
}

function formatPreviewValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'object' && 'type' in value) return null
  return String(value)
}

// ─── Address helpers ──────────────────────────────────────────────────────────

/** Convert column letter(s) to 0-based index. "A" → 0, "Z" → 25, "AA" → 26 */
function colLettersToIndex(letters: string): number {
  const upper = letters.toUpperCase().replace(/\$/g, '')
  let index = 0
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64)
  }
  return index - 1
}

/** Convert a cell address string like "B3" or "$B$3" to {row, col} (0-based). */
function cellAddressToRC(addr: string): { row: number; col: number } | null {
  const clean = addr.replace(/\$/g, '')
  const m = /^([A-Za-z]+)(\d+)$/.exec(clean)
  if (!m || !m[1] || !m[2]) return null
  const col = colLettersToIndex(m[1])
  const row = parseInt(m[2], 10) - 1
  return { row, col }
}

/**
 * Extended reference extractor: returns a flat list of all individual {row, col}
 * cells that a formula references, including every cell inside ranges like A1:A10.
 *
 * Also returns a cross-sheet map: sheetName → Set of "r:c" strings for cells
 * referenced on other sheets.
 */
interface ExtractedRefs {
  /** Active sheet cells to include: set of "r:c" string keys */
  localCells: Set<string>
  /** Per other-sheet-name: set of "r:c" string keys */
  crossSheetCells: Map<string, Set<string>>
}

function extractAllReferencedCells(formula: string): ExtractedRefs {
  // Regex: optional sheet prefix, start cell, optional range end
  const pattern =
    /(?:('(?:[^']|'')*'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]+\$?\d+)(?::(\$?[A-Z]+\$?\d+))?/gi

  const localCells = new Set<string>()
  const crossSheetCells = new Map<string, Set<string>>()

  let match: RegExpExecArray | null
  while ((match = pattern.exec(formula)) !== null) {
    const sheetPrefix = match[1] ?? null
    const startStr = match[2]
    const endStr = match[3] ?? null

    if (!startStr) continue

    const start = cellAddressToRC(startStr)
    if (!start) continue

    let cells: Array<{ row: number; col: number }> = []

    if (endStr) {
      const end = cellAddressToRC(endStr)
      if (end) {
        const rMin = Math.min(start.row, end.row)
        const rMax = Math.max(start.row, end.row)
        const cMin = Math.min(start.col, end.col)
        const cMax = Math.max(start.col, end.col)
        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            cells.push({ row: r, col: c })
          }
        }
      } else {
        cells = [start]
      }
    } else {
      cells = [start]
    }

    if (sheetPrefix) {
      // Strip surrounding quotes if present
      const name = sheetPrefix.startsWith("'")
        ? sheetPrefix.slice(1, -1).replace(/''/g, "'")
        : sheetPrefix
      if (!crossSheetCells.has(name)) crossSheetCells.set(name, new Set())
      const set = crossSheetCells.get(name)!
      for (const c of cells) set.add(`${c.row}:${c.col}`)
    } else {
      for (const c of cells) localCells.add(`${c.row}:${c.col}`)
    }
  }

  return { localCells, crossSheetCells }
}

// ─── Cell value lookup ────────────────────────────────────────────────────────

type FormulaValue = string | number | boolean | null

function getCellPrimitiveValue(sheet: Sheet, row: number, col: number): FormulaValue {
  // Try the 2D data matrix first (faster)
  const fromData = sheet.data?.[row]?.[col]
  if (fromData !== undefined) {
    const cell = fromData ?? null
    const v = getCellDisplayValue(cell)
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
    return null
  }
  // Fall back to sparse celldata
  const cellEntry = sheet.celldata?.find((c) => c.r === row && c.c === col)
  if (!cellEntry) return null
  const cellVal = cellEntry.v
  if (!cellVal) return null
  // If the cell has a formula, expose it so HF can evaluate dependencies
  if (cellVal.f) return `=${cellVal.f}`
  if (cellVal.v !== undefined && cellVal.v !== null) {
    const val = cellVal.v
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val
    return null
  }
  const display = getCellDisplayValue(cellVal as never)
  if (typeof display === 'string' || typeof display === 'number' || typeof display === 'boolean')
    return display
  return null
}

/**
 * Build a minimal FormulaValue[][] matrix from a sheet, containing only the
 * cells specified in `cellKeys` (a set of "r:c" strings).
 *
 * The returned matrix is sized to fit the maximum row/col needed.
 */
function buildMinimalMatrix(sheet: Sheet, cellKeys: Set<string>): FormulaValue[][] {
  if (cellKeys.size === 0) return [[]]

  let maxRow = 0
  let maxCol = 0
  for (const key of cellKeys) {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0', 10)
    const c = parseInt(cStr ?? '0', 10)
    if (r > maxRow) maxRow = r
    if (c > maxCol) maxCol = c
  }

  const matrix: FormulaValue[][] = Array.from({ length: maxRow + 1 }, () =>
    Array.from<FormulaValue>({ length: maxCol + 1 }).fill(null)
  )

  for (const key of cellKeys) {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0', 10)
    const c = parseInt(cStr ?? '0', 10)
    const val = getCellPrimitiveValue(sheet, r, c)
    if (val !== null) {
      matrix[r]![c] = val
    }
  }

  return matrix
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLivePreview(): LivePreviewResult {
  const { formulaBarValue, editingCell, gridSheets } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const [result, setResult] = useState<LivePreviewResult>({
    previewValue: null,
    references: [],
    isValid: false,
  })

  const activeSheetIndex = useMemo(() => {
    const index = gridSheets.findIndex((sheet) => sheet.id === activeSheetId)
    return index >= 0 ? index : 0
  }, [activeSheetId, gridSheets])

  useEffect(() => {
    if (!editingCell || !formulaBarValue.startsWith('=')) {
      setResult({ previewValue: null, references: [], isValid: false })
      return
    }

    const timer = window.setTimeout(() => {
      let hf: HyperFormula | null = null
      try {
        const activeSheet = gridSheets[activeSheetIndex]
        if (!activeSheet) {
          setResult({ previewValue: null, references: [], isValid: false })
          return
        }

        const activeSheetName = activeSheet.name ?? `Sheet${activeSheetIndex + 1}`

        // 1. Extract only the cells the formula actually references
        const { localCells, crossSheetCells } = extractAllReferencedCells(formulaBarValue)

        // Always include the editing cell in the local sheet (it will hold the formula)
        const editingKey = `${editingCell.row}:${editingCell.col}`
        localCells.delete(editingKey) // formula cell value comes from formulaBarValue, not grid

        // 2. Build the minimal sheets map
        const sheets: Record<string, FormulaValue[][]> = {}

        // Active sheet: only referenced cells
        sheets[activeSheetName] = buildMinimalMatrix(activeSheet, localCells)

        // Grow active sheet matrix to include the editing cell position
        const activeMatrix = sheets[activeSheetName]!
        while (activeMatrix.length <= editingCell.row) {
          activeMatrix.push(Array.from<FormulaValue>({ length: activeMatrix[0]?.length ?? 1 }).fill(null))
        }
        const activeRow = activeMatrix[editingCell.row]!
        while (activeRow.length <= editingCell.col) activeRow.push(null)

        // 3. Add cross-sheet dependencies
        for (const [sheetName, cells] of crossSheetCells) {
          const crossSheet = gridSheets.find((s) => s.name === sheetName)
          if (crossSheet) {
            sheets[sheetName] = buildMinimalMatrix(crossSheet, cells)
          } else {
            // Sheet not found — provide an empty placeholder so HF doesn't throw
            sheets[sheetName] = [[]]
          }
        }

        // 4. Build HF from the minimal sheets (no singleton — dedicated instance per evaluation)
        hf = HyperFormula.buildFromSheets(sheets, HYPERFORMULA_CONFIG)

        // 5. Set the formula on the editing cell
        const sheetId = hf.getSheetId(activeSheetName)
        if (sheetId === undefined) {
          setResult({ previewValue: null, references: [], isValid: false })
          return
        }

        hf.setCellContents(
          { sheet: sheetId, row: editingCell.row, col: editingCell.col },
          [[formulaBarValue]]
        )

        // 6. Evaluate
        const previewValue = formatPreviewValue(
          hf.getCellValue({ sheet: sheetId, row: editingCell.row, col: editingCell.col })
        )

        setResult({
          previewValue,
          references: extractCellReferences(formulaBarValue),
          isValid: previewValue !== null,
        })
      } catch {
        setResult({ previewValue: null, references: [], isValid: false })
      } finally {
        hf?.destroy()
      }
    }, 150)

    return () => window.clearTimeout(timer)
  }, [activeSheetIndex, editingCell, formulaBarValue, gridSheets])

  return result
}
