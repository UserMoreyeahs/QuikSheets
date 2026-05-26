'use client'

/**
 * GoalSeekDialog — Excel's Data > What-If Analysis > Goal Seek.
 *
 *   ┌──────────────── Inputs step ─────────────────┐
 *   │  Set cell:           [ B5  ]   (formula)     │
 *   │  To value:           [ 1180 ]                │
 *   │  By changing cell:   [ A5  ]   (value)       │
 *   │              [ Cancel ]  [ OK → solve ]      │
 *   └──────────────────────────────────────────────┘
 *
 *   ┌──────────────── Result step ─────────────────┐
 *   │  Goal Seeking with Cell B5 found a solution. │
 *   │  Target:         1180                        │
 *   │  Current:        1180.00                     │
 *   │  Changing cell:  A5 → 1000.00                │
 *   │              [ Cancel ]  [ OK → commit ]     │
 *   └──────────────────────────────────────────────┘
 *
 * OK commits the change to gridSheets via replaceGridSheets.
 * Cancel restores by simply closing — the grid hasn't been written yet.
 */

import { useEffect, useMemo, useState } from 'react'
import { Search, Target, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGoalSeekStore } from '@/features/goal-seek/store/goalSeekStore'
import { useSheetStore } from '@/store/sheetStore'
import { fromCellNotation, toCellNotation } from '@/lib/cellAddress'
import {
  cloneSheetWithData,
  getCellFromSheet,
  getSheetMatrix,
} from '@/lib/fortuneSheet'
import { getFormulaEngine } from '@/features/formula/getFormulaEngine'
import type { FormulaValue, FormulaWorkbook } from '@/features/formula/FormulaEngineAdapter'
import type { Cell, CellMatrix, Sheet } from '@fortune-sheet/core'
import {
  GOAL_SEEK_EPSILON,
  GOAL_SEEK_MAX_ITERATIONS,
  goalSeek,
  type GoalSeekResult,
} from '../utils/goalSeekSolver'

type Step = 'inputs' | 'result'

interface ParsedAddress {
  row: number
  col: number
  notation: string
}

interface ResolvedAddress {
  row: number
  col: number
  notation: string
  /** Raw cell at that address (null when empty). */
  cell: Cell | null
}

function tryParseAddress(input: string): ParsedAddress | null {
  const cleaned = input.trim().toUpperCase()
  if (!cleaned) return null
  try {
    const { row, col } = fromCellNotation(cleaned)
    return { row, col, notation: cleaned }
  } catch {
    return null
  }
}

function isFormulaCell(cell: Cell | null): boolean {
  return !!cell?.f
}

function isValueCellOrEmpty(cell: Cell | null): boolean {
  // "Value cell" = not a formula. Empty cells are also acceptable
  // (Excel allows Goal Seek to seed an empty cell with the solution).
  return !cell?.f
}

function currentCellNumber(cell: Cell | null): number {
  if (!cell) return 0
  const v = cell.v
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  // m fallback (display value) — strip commas, %, $ etc.
  if (typeof cell.m === 'string') {
    const n = Number(cell.m.replace(/[^0-9eE.+-]/g, ''))
    if (Number.isFinite(n)) return n
  }
  return 0
}

function buildFormulaWorkbookFromSheets(
  sheets: Sheet[],
  activeIndex: number
): FormulaWorkbook {
  const out: Record<string, FormulaValue[][]> = {}
  let activeName = ''
  sheets.forEach((sheet, idx) => {
    const name = sheet.name ?? `Sheet${idx + 1}`
    if (idx === activeIndex) activeName = name
    const matrix = getSheetMatrix(sheet)
    const grid: FormulaValue[][] = matrix.map((row) =>
      (row ?? []).map((cell) => {
        if (!cell) return null
        if (cell.f) return `=${cell.f}`
        const v = cell.v
        if (v === null || v === undefined) return null
        return v as FormulaValue
      })
    )
    out[name] = grid
  })
  if (!activeName) activeName = Object.keys(out)[0] ?? 'Sheet1'
  return { sheets: out, activeSheetName: activeName }
}

/**
 * Returns a finite number for the formula cell evaluated under `workbook`,
 * or NaN when the formula errored / returned a non-numeric value.
 */
function evaluateFormulaCellAsNumber(
  workbook: FormulaWorkbook,
  setCell: ResolvedAddress,
  formula: string
): number {
  const engine = getFormulaEngine()
  const result = engine.evaluateFormula(formula, {
    workbook,
    cell: {
      sheetName: workbook.activeSheetName,
      row: setCell.row,
      col: setCell.col,
    },
  })
  if (!result.ok) return NaN
  const v = result.value
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }
  if (typeof v === 'boolean') return v ? 1 : 0
  return NaN
}

export function GoalSeekDialog() {
  const isOpen = useGoalSeekStore((s) => s.isOpen)
  const close = useGoalSeekStore((s) => s.close)

  const [step, setStep] = useState<Step>('inputs')
  const [setCellInput, setSetCellInput] = useState('')
  const [toValueInput, setToValueInput] = useState('')
  const [changingCellInput, setChangingCellInput] = useState('')
  const [solving, setSolving] = useState(false)
  const [result, setResult] = useState<GoalSeekResult | null>(null)
  // Snapshot of the addresses + original value so we can render the result
  // panel even after solving and decide what to write on OK.
  const [resolved, setResolved] = useState<{
    setCell: ResolvedAddress
    changingCell: ResolvedAddress
    originalChangingValue: number
    target: number
  } | null>(null)

  // Reset every time the dialog is reopened. Pre-fill "Set cell" with the
  // currently selected cell when it's a formula cell — matches Excel UX.
  useEffect(() => {
    if (!isOpen) return
    setStep('inputs')
    setSolving(false)
    setResult(null)
    setResolved(null)

    const state = useSheetStore.getState()
    const activeSheet =
      state.gridSheets.find((s) => s.status === 1) ?? state.gridSheets[0]
    if (state.selectedCell && activeSheet) {
      const cell = getCellFromSheet(activeSheet, state.selectedCell.row, state.selectedCell.col)
      const notation = toCellNotation(state.selectedCell.row, state.selectedCell.col)
      if (cell?.f) {
        setSetCellInput(notation)
        setChangingCellInput('')
      } else {
        setSetCellInput('')
        setChangingCellInput(notation)
      }
    } else {
      setSetCellInput('')
      setChangingCellInput('')
    }
    setToValueInput('')
  }, [isOpen])

  // Live validation — re-evaluates on every keystroke.
  const validation = useMemo(() => {
    if (!isOpen) return null
    const state = useSheetStore.getState()
    const activeIndex = state.gridSheets.findIndex((s) => s.status === 1)
    const safeIndex = activeIndex >= 0 ? activeIndex : 0
    const activeSheet = state.gridSheets[safeIndex]
    if (!activeSheet) {
      return { ok: false as const, message: 'No active sheet.' }
    }

    const setAddr = tryParseAddress(setCellInput)
    const changingAddr = tryParseAddress(changingCellInput)
    const targetNum = Number(toValueInput)

    if (!setAddr) return { ok: false as const, message: 'Set cell must be a valid address like B5.' }
    if (toValueInput.trim() === '' || !Number.isFinite(targetNum)) {
      return { ok: false as const, message: 'To value must be a number.' }
    }
    if (!changingAddr) return { ok: false as const, message: 'By changing cell must be a valid address like A5.' }
    if (setAddr.notation === changingAddr.notation) {
      return { ok: false as const, message: 'Set cell and changing cell must be different.' }
    }

    const setCell = getCellFromSheet(activeSheet, setAddr.row, setAddr.col)
    const changingCell = getCellFromSheet(activeSheet, changingAddr.row, changingAddr.col)

    if (!isFormulaCell(setCell)) {
      return { ok: false as const, message: `Set cell ${setAddr.notation} must contain a formula.` }
    }
    if (!isValueCellOrEmpty(changingCell)) {
      return { ok: false as const, message: `Changing cell ${changingAddr.notation} must contain a value, not a formula.` }
    }

    return {
      ok: true as const,
      activeSheet,
      activeIndex: safeIndex,
      target: targetNum,
      setCell: { ...setAddr, cell: setCell } satisfies ResolvedAddress,
      changingCell: { ...changingAddr, cell: changingCell } satisfies ResolvedAddress,
    }
  }, [isOpen, setCellInput, toValueInput, changingCellInput])

  function runSolver() {
    if (!validation || !validation.ok) {
      toast.error(validation?.message ?? 'Invalid Goal Seek inputs')
      return
    }
    const { activeSheet, activeIndex, setCell, changingCell, target } = validation
    const formula = `=${setCell.cell!.f}`

    // Build the workbook snapshot once. Then for every probe just patch
    // the changing-cell slot and re-evaluate. HyperFormula builds a new
    // instance per call (see HyperFormulaAdapter.evaluateFormula), so we
    // pay an O(workbook-size) cost per iteration — acceptable because
    // the solver runs at most ~100 iterations and small workbooks finish
    // well under a second.
    const state = useSheetStore.getState()
    const baseWorkbook = buildFormulaWorkbookFromSheets(state.gridSheets, activeIndex)
    const sheetGrid = baseWorkbook.sheets[baseWorkbook.activeSheetName]
    if (!sheetGrid) {
      toast.error('Could not build formula workbook')
      return
    }

    const startValue = currentCellNumber(changingCell.cell)

    setSolving(true)
    // Run synchronously inside a microtask so the UI shows the spinner.
    queueMicrotask(() => {
      let solverResult: GoalSeekResult
      try {
        solverResult = goalSeek({
          startValue,
          target,
          evaluate: (x) => {
            // Patch the changing cell. Ensure the row exists in the
            // workbook matrix (it might not if the changing cell is in
            // an empty area beyond current data).
            let row = sheetGrid[changingCell.row]
            if (!row) {
              row = []
              sheetGrid[changingCell.row] = row
            }
            while (row.length <= changingCell.col) row.push(null)
            row[changingCell.col] = x
            return evaluateFormulaCellAsNumber(baseWorkbook, setCell, formula)
          },
        })
      } catch (err) {
        setSolving(false)
        toast.error(`Goal Seek failed: ${err instanceof Error ? err.message : String(err)}`)
        return
      }

      setSolving(false)
      setResolved({
        setCell,
        changingCell,
        originalChangingValue: startValue,
        target,
      })

      if (!solverResult.converged) {
        toast.error(
          `Could not find a solution${solverResult.reason ? ` — ${solverResult.reason.toLowerCase()}` : ''}.`
        )
        // Leave the dialog open at the inputs step so the user can adjust.
        // Avoid jumping to the result panel for a non-convergent solve.
        return
      }

      setResult(solverResult)
      setStep('result')

      // Reference unused values to satisfy strict TS noUnused (activeSheet
      // is used implicitly via state.gridSheets in commit()).
      void activeSheet
    })
  }

  function commit() {
    if (!resolved || !result) return
    const { changingCell } = resolved
    const state = useSheetStore.getState()
    const activeIndex = state.gridSheets.findIndex((s) => s.status === 1)
    const safeIndex = activeIndex >= 0 ? activeIndex : 0
    const target = state.gridSheets[safeIndex]
    if (!target) {
      toast.error('Active sheet vanished during solve')
      close()
      return
    }

    const matrix: CellMatrix = getSheetMatrix(target).map((row) => [...(row ?? [])])
    let row = matrix[changingCell.row]
    if (!row) {
      row = []
      matrix[changingCell.row] = row
    }
    while (row.length <= changingCell.col) row.push(null)

    // Round to the smallest representation that survives a Number()
    // round-trip — Excel writes the raw solver output, but it tends to
    // be ugly (1000.0000000000001). For the canonical A1*1.18 = 1180
    // case the solver converges below epsilon = 1e-6, so 10 sig figs
    // captures the answer without showing junk digits.
    const solution = Number(result.solution.toPrecision(12))

    const existingCell = (row[changingCell.col] ?? null) as Cell | null
    const nextCell: Cell = {
      ...(existingCell ?? {}),
      v: solution,
      m: String(solution),
    }
    // Defensive: clear any stale formula on the changing cell. Shouldn't
    // be possible (validation rejects formula cells) but if a race
    // changed the cell mid-solve, ensure we don't leave a hybrid value.
    delete (nextCell as { f?: string }).f

    row[changingCell.col] = nextCell

    const nextSheets = state.gridSheets.map((s, i) =>
      i === safeIndex ? cloneSheetWithData(s, matrix) : s
    )
    state.replaceGridSheets(nextSheets)
    toast.success(
      `Goal Seek applied: ${changingCell.notation} = ${solution}`
    )
    close()
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            Goal Seek
          </DialogTitle>
        </DialogHeader>

        {step === 'inputs' && (
          <>
            <div className="space-y-3 py-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Find the input value that makes a formula produce the target output.
              </p>
              <Row label="Set cell" hint="Formula cell (e.g. B5)">
                <Input
                  value={setCellInput}
                  onChange={(e) => setSetCellInput(e.target.value)}
                  placeholder="B5"
                  autoFocus
                />
              </Row>
              <Row label="To value" hint="Target number">
                <Input
                  type="number"
                  value={toValueInput}
                  onChange={(e) => setToValueInput(e.target.value)}
                  placeholder="1180"
                />
              </Row>
              <Row label="By changing cell" hint="Value cell to adjust (e.g. A5)">
                <Input
                  value={changingCellInput}
                  onChange={(e) => setChangingCellInput(e.target.value)}
                  placeholder="A5"
                />
              </Row>
              {validation && !validation.ok && (setCellInput || toValueInput || changingCellInput) && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{validation.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={solving}>Cancel</Button>
              <Button onClick={runSolver} disabled={!validation?.ok || solving}>
                {solving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
                {solving ? 'Solving…' : 'OK'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'result' && resolved && result && (
          <>
            <div className="space-y-2 py-2 text-sm">
              <p className="text-zinc-900 dark:text-zinc-100">
                Goal Seeking with Cell <strong>{resolved.setCell.notation}</strong> found a solution.
              </p>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
                <dt className="text-zinc-500 dark:text-zinc-400">Target value:</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{resolved.target}</dd>
                <dt className="text-zinc-500 dark:text-zinc-400">Current value:</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{formatResult(result.resultValue)}</dd>
                <dt className="text-zinc-500 dark:text-zinc-400">Changing cell:</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {resolved.changingCell.notation} → {formatResult(result.solution)}
                </dd>
              </dl>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Iterations: {result.iterations} / {GOAL_SEEK_MAX_ITERATIONS} (ε = {GOAL_SEEK_EPSILON})
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={commit}>OK</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <label className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
        {label}
        {hint && <div className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">{hint}</div>}
      </label>
      {children}
    </div>
  )
}

function formatResult(n: number): string {
  if (!Number.isFinite(n)) return '—'
  // 2 dp for the readable display, mirroring the spec's "1180.00" example.
  return n.toFixed(2)
}
