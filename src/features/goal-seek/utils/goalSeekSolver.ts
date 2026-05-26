/**
 * Goal Seek solver — finds an input value that makes a formula produce
 * a target output, mirroring Excel's Data > What-If Analysis > Goal Seek.
 *
 * Strategy:
 *   1. Bracket — probe ±1, ±10, ±100, … up to ±1e6 around the current input
 *      until two probes straddle the target (f(lo) − target and f(hi) − target
 *      have opposite signs). If no bracket is found, report no solution.
 *   2. Bisect — binary-search the bracket until |f(x) − target| < epsilon
 *      or `MAX_ITERATIONS` is reached.
 *
 * The solver is engine-agnostic: callers pass an `evaluate(x)` callback
 * that knows how to write `x` into the changing cell and read the
 * formula cell's value. This keeps the solver:
 *   - pure (no HyperFormula import here) → trivially unit-testable
 *   - decoupled from the adapter so a future Univer formula engine can
 *     reuse the exact same solver.
 */

export const GOAL_SEEK_EPSILON = 1e-6
export const GOAL_SEEK_MAX_ITERATIONS = 100
export const GOAL_SEEK_PROBE_LIMIT = 1e6

export interface GoalSeekResult {
  /** True when the solver converged to within `GOAL_SEEK_EPSILON` of `target`. */
  converged: boolean
  /** The input value (changing cell) the solver settled on. */
  solution: number
  /** The formula cell value at `solution`. */
  resultValue: number
  /** Total iterations consumed across bracketing + bisection. */
  iterations: number
  /** Human-readable reason when `converged` is false. */
  reason?: string
}

export interface GoalSeekParams {
  /** Current value of the changing cell. Used as the search origin. */
  startValue: number
  /** Number we want the formula cell to equal. */
  target: number
  /**
   * Callback that writes `x` into the changing cell, recomputes the
   * formula cell, and returns the result. Should return NaN when the
   * formula evaluates to a non-numeric / error value at that input.
   */
  evaluate: (x: number) => number
  /** Override convergence threshold. Default `GOAL_SEEK_EPSILON`. */
  epsilon?: number
  /** Override iteration cap. Default `GOAL_SEEK_MAX_ITERATIONS`. */
  maxIterations?: number
}

/**
 * Excel-style Goal Seek solver.
 *
 * Returns immediately on `converged = true` when:
 *   - The starting input already produces a result within `epsilon` of `target`.
 *   - A bracket probe accidentally lands within `epsilon` of `target`.
 *   - Bisection narrows |f(x) − target| below `epsilon`.
 *
 * Returns `converged = false` when:
 *   - No bracket was found within ±1e6 of `startValue`.
 *   - The bisection consumed all `maxIterations` without converging.
 *   - The starting input evaluates to a non-finite number AND no probe finds
 *     a finite evaluation either.
 */
export function goalSeek({
  startValue,
  target,
  evaluate,
  epsilon = GOAL_SEEK_EPSILON,
  maxIterations = GOAL_SEEK_MAX_ITERATIONS,
}: GoalSeekParams): GoalSeekResult {
  if (!Number.isFinite(startValue)) {
    return {
      converged: false,
      solution: startValue,
      resultValue: NaN,
      iterations: 0,
      reason: 'Starting value must be a finite number',
    }
  }
  if (!Number.isFinite(target)) {
    return {
      converged: false,
      solution: startValue,
      resultValue: NaN,
      iterations: 0,
      reason: 'Target value must be a finite number',
    }
  }

  let iterations = 0

  // ── 0. Try the starting value itself ────────────────────────────────────
  const f0 = evaluate(startValue)
  iterations += 1
  if (Number.isFinite(f0) && Math.abs(f0 - target) < epsilon) {
    return { converged: true, solution: startValue, resultValue: f0, iterations }
  }

  // ── 1. Bracketing — probe ±1, ±10, ±100, … around startValue ────────────
  // We grow the step geometrically so we can reach faraway solutions in
  // O(log) probes. The two arrays (positive/negative) advance in parallel.
  type Probe = { x: number; fx: number }
  let lo: Probe | null = null
  let hi: Probe | null = null

  // If f0 is finite we can treat startValue as one side of a potential
  // bracket. We still need to find a probe that lands on the opposite
  // side of `target`.
  if (Number.isFinite(f0)) {
    if (f0 < target) lo = { x: startValue, fx: f0 }
    else hi = { x: startValue, fx: f0 }
  }

  let step = 1
  while (step <= GOAL_SEEK_PROBE_LIMIT && iterations < maxIterations) {
    for (const direction of [1, -1]) {
      const x = startValue + direction * step
      const fx = evaluate(x)
      iterations += 1

      if (!Number.isFinite(fx)) {
        if (iterations >= maxIterations) break
        continue
      }

      // Probe accidentally hits the target — done.
      if (Math.abs(fx - target) < epsilon) {
        return { converged: true, solution: x, resultValue: fx, iterations }
      }

      if (fx < target) {
        if (!lo || Math.abs(target - fx) < Math.abs(target - lo.fx)) {
          lo = { x, fx }
        }
      } else {
        if (!hi || Math.abs(target - fx) < Math.abs(target - hi.fx)) {
          hi = { x, fx }
        }
      }

      if (lo && hi) break
      if (iterations >= maxIterations) break
    }

    if (lo && hi) break
    if (iterations >= maxIterations) break
    step *= 10
  }

  if (!lo || !hi) {
    const last = hi ?? lo
    return {
      converged: false,
      solution: last?.x ?? startValue,
      resultValue: last?.fx ?? f0,
      iterations,
      reason: 'No solution bracket found within ±1e6 of the starting value',
    }
  }

  // ── 2. Bisection — narrow [lo.x, hi.x] until |f(x) − target| < epsilon ──
  // The IVT guarantees a root in this interval because lo.fx < target < hi.fx
  // (or vice-versa) and f is sampled, not analytic — but for a continuous
  // formula like A1*1.18 or A1*A1 this is the same logic Excel uses.
  // Reassign to non-null mutable aliases so TypeScript stops widening
  // back to `Probe | null` inside the loop body (where lo/hi are
  // reassigned). The previous loop body never reads them as null.
  let loP: Probe = lo
  let hiP: Probe = hi
  let best: Probe = Math.abs(loP.fx - target) <= Math.abs(hiP.fx - target) ? loP : hiP
  while (iterations < maxIterations) {
    const mid: number = (loP.x + hiP.x) / 2
    const fmid: number = evaluate(mid)
    iterations += 1

    if (!Number.isFinite(fmid)) {
      // Bisecting hit a discontinuity / error. Nudge the bracket to
      // the side we trust more (the closer of lo / hi) and continue.
      if (Math.abs(loP.fx - target) <= Math.abs(hiP.fx - target)) {
        hiP = { x: mid, fx: hiP.fx }
      } else {
        loP = { x: mid, fx: loP.fx }
      }
      continue
    }

    if (Math.abs(fmid - target) < epsilon) {
      return { converged: true, solution: mid, resultValue: fmid, iterations }
    }

    if (Math.abs(fmid - target) < Math.abs(best.fx - target)) {
      best = { x: mid, fx: fmid }
    }

    if (fmid < target) loP = { x: mid, fx: fmid }
    else hiP = { x: mid, fx: fmid }

    // If the bracket has collapsed below machine precision relative to
    // the magnitude of `mid`, additional bisection cannot make progress
    // (the midpoint coincides with one of the endpoints under IEEE 754).
    // Use Number.EPSILON × scale rather than user-facing `epsilon` so we
    // only bail at true numerical floor, not at the convergence target.
    const scale = Math.max(1, Math.abs(loP.x), Math.abs(hiP.x))
    if (Math.abs(hiP.x - loP.x) < Number.EPSILON * scale * 4) {
      break
    }
  }

  return {
    converged: false,
    solution: best.x,
    resultValue: best.fx,
    iterations,
    reason:
      iterations >= maxIterations
        ? `Did not converge within ${maxIterations} iterations`
        : 'Bracket collapsed before convergence',
  }
}
