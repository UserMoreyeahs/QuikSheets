import type { Sheet, Cell } from '@fortune-sheet/core'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import { evaluateCell } from '@/features/formula-engine/formulaEngine'

/**
 * Self-heal formula cells in workbooks SAVED BEFORE the formula-seed fix.
 *
 * Two defects this repairs, both observed in real persisted workbooks:
 *   1. `f` stored WITH a leading "=" (e.g. `"=C2*D2"`). The whole codebase
 *      stores `f` WITHOUT it (createCell slices it, the edit path slices it,
 *      every template omits it, the formula bar prepends one). A leading "="
 *      is unparseable in-grid and renders the formula bar as "==C2*D2".
 *   2. A formula cell with NO cached `v`/`m`. FortuneSheet does not reliably
 *      recompute value-less formula cells on mount, so they render BLANK —
 *      this was the "Revenue column is blank on every saved workbook" bug.
 *      Every working surface (templates, the fixed sample seed) caches `v`.
 *
 * The heal: strip the leading "=", and for any formula cell still missing a
 * value, compute it with the shared formula engine (which resolves nested and
 * cross-sheet references) and cache `v`/`m` so it paints immediately.
 *
 * SAFETY: only formula cells that are broken (leading "=" or no value) are
 * touched; a cell that already carries a cached value is never overwritten, so
 * correctly-saved workbooks are returned byte-for-byte unchanged. Pure function
 * — clones any cell it modifies, never mutates the caller's objects.
 */
export function healHydratedSheets(sheets: Sheet[]): Sheet[] {
  if (!Array.isArray(sheets) || sheets.length === 0) return sheets
  // Cheap pre-scan: if nothing needs healing, return the input untouched so the
  // common (healthy) load path is a no-op.
  if (!sheets.some(sheetNeedsHeal)) return sheets

  // 1) Materialize each sheet as a matrix and normalize formula text
  //    (strip a leading "="), cloning only the cells we change.
  const matrices = sheets.map((sheet) =>
    getSheetMatrix(sheet).map((row) =>
      row.map((cell) =>
        cell && typeof cell.f === 'string' && cell.f.startsWith('=')
          ? ({ ...cell, f: cell.f.replace(/^=+/, '') } as Cell)
          : cell,
      ),
    ),
  )

  // 2) Compute values for formula cells that are still missing one. Build
  //    celldata-bearing sheets (with normalized `f`) so the engine can resolve
  //    references — including across sheets — while we fill the blanks.
  const engineSheets: Sheet[] = sheets.map((sheet, i) => ({
    ...sheet,
    celldata: matrixToCelldata(matrices[i] ?? []),
  }))

  matrices.forEach((matrix, si) => {
    for (let r = 0; r < matrix.length; r += 1) {
      const row = matrix[r]
      if (!row) continue
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c]
        if (!cell?.f || hasValue(cell)) continue
        const result = evaluateCell(`=${cell.f}`, engineSheets, r, c, si)
        // Cache only real scalar results. Leave engine errors (`#…!`) and nulls
        // alone so we never bake a stale error string into a cell — the grid
        // surfaces its own error on recompute.
        if (result !== null && result !== undefined && !(typeof result === 'string' && result.startsWith('#'))) {
          // Strip binary-float noise so the display matches FortuneSheet's own
          // compute (120 * 9.99 → 1198.8, not 1198.8000000000002).
          const value = typeof result === 'number' ? cleanFloat(result) : result
          row[c] = { ...cell, v: value, m: String(value) }
        }
      }
    }
  })

  return sheets.map((sheet, i) => cloneSheetWithData(sheet, matrices[i] ?? []))
}

/** A cell carries a usable cached value (so it renders without recompute). */
function hasValue(cell: Cell): boolean {
  return cell.v !== undefined && cell.v !== null && cell.v !== ''
}

/** Drop IEEE-754 noise from a computed number (1198.8000000000002 → 1198.8). */
function cleanFloat(n: number): number {
  return Number.isFinite(n) ? parseFloat(n.toPrecision(12)) : n
}

/** True if any formula cell needs the heal (leading "=" or no cached value). */
function cellNeedsHeal(cell: Cell | null | undefined): boolean {
  if (!cell || typeof cell.f !== 'string' || cell.f.length === 0) return false
  return cell.f.startsWith('=') || !hasValue(cell)
}

function sheetNeedsHeal(sheet: Sheet): boolean {
  if (Array.isArray(sheet.data)) {
    for (const row of sheet.data) {
      if (row) for (const cell of row) if (cellNeedsHeal(cell)) return true
    }
  }
  if (Array.isArray(sheet.celldata)) {
    for (const cd of sheet.celldata) if (cellNeedsHeal(cd.v)) return true
  }
  return false
}

function matrixToCelldata(matrix: (Cell | null)[][]): { r: number; c: number; v: Cell }[] {
  const celldata: { r: number; c: number; v: Cell }[] = []
  matrix.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell) celldata.push({ r, c, v: cell })
    }),
  )
  return celldata
}
