import { describe, it, expect } from 'vitest'
import {
  GOAL_SEEK_EPSILON,
  GOAL_SEEK_MAX_ITERATIONS,
  goalSeek,
} from '@/features/goal-seek/utils/goalSeekSolver'

/**
 * Tests pin the three canonical Goal Seek scenarios from the spec:
 *
 *   1.  B5 = A5 * 1.18 = 1180   →  A5 = 1000        (linear / monotonic)
 *   2.  B5 = A5 * A5  = 100     →  A5 = 10 or -10   (quadratic; both roots valid)
 *   3.  Cancel-flow uses pre-solve startValue; we don't test the dialog
 *       here, but we verify the solver doesn't mutate inputs.
 *   4.  Non-convergent — e.g. evaluate always returns 1 → no bracket → fail.
 */

describe('goalSeek solver (binary-search)', () => {
  it('finds A5 = 1000 when B5 (=A5*1.18) targets 1180', () => {
    // Mirror Excel's seed: A5 starts at any reasonable value, e.g. 500.
    const result = goalSeek({
      startValue: 500,
      target: 1180,
      evaluate: (x) => x * 1.18,
    })
    expect(result.converged).toBe(true)
    expect(Math.abs(result.solution - 1000)).toBeLessThan(1e-3)
    expect(Math.abs(result.resultValue - 1180)).toBeLessThan(GOAL_SEEK_EPSILON)
    expect(result.iterations).toBeLessThanOrEqual(GOAL_SEEK_MAX_ITERATIONS)
  })

  it('finds 10 or -10 when B5 (=A5*A5) targets 100', () => {
    const result = goalSeek({
      startValue: 1,
      target: 100,
      evaluate: (x) => x * x,
    })
    expect(result.converged).toBe(true)
    expect([10, -10].some((root) => Math.abs(result.solution - root) < 1e-3)).toBe(true)
    expect(Math.abs(result.resultValue - 100)).toBeLessThan(GOAL_SEEK_EPSILON)
  })

  it('returns startValue immediately when the formula already matches the target', () => {
    const result = goalSeek({
      startValue: 7,
      target: 49,
      evaluate: (x) => x * x,
    })
    expect(result.converged).toBe(true)
    expect(result.solution).toBe(7)
    expect(result.iterations).toBe(1)
  })

  it('handles a target that requires bracketing on the negative side', () => {
    // Linear with a negative slope: f(x) = -2x + 10. Target 30 → x = -10.
    const result = goalSeek({
      startValue: 0,
      target: 30,
      evaluate: (x) => -2 * x + 10,
    })
    expect(result.converged).toBe(true)
    expect(Math.abs(result.solution - -10)).toBeLessThan(1e-3)
  })

  it('reports no convergence when target is unreachable (constant function)', () => {
    const result = goalSeek({
      startValue: 5,
      target: 42,
      evaluate: () => 1, // constant — can never equal 42
    })
    expect(result.converged).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('respects the iteration cap', () => {
    // Function with no bracket within ±1e6 — solver should give up after
    // probing both directions and consuming iterations.
    const cap = 20
    const result = goalSeek({
      startValue: 0,
      target: 0.5,
      evaluate: (x) => (x === 0 ? 0 : 1), // discontinuous step
      maxIterations: cap,
    })
    // Either it didn't converge OR it converged on a probe that hit
    // step value matching 0.5 (it won't — function only returns 0 or 1).
    expect(result.converged).toBe(false)
    expect(result.iterations).toBeLessThanOrEqual(cap)
  })

  it('handles non-finite evaluations gracefully (division by zero etc.)', () => {
    // f(x) = 10 / x. Target 2 → solution 5.
    // The startValue must sit on the same side of the discontinuity (x=0)
    // as the real solution — same constraint Excel's Goal Seek imposes.
    // Picking startValue=1 keeps the probe series on x>0 where f is
    // continuous and monotonic.
    const result = goalSeek({
      startValue: 1,
      target: 2,
      evaluate: (x) => 10 / x,
    })
    expect(result.converged).toBe(true)
    expect(Math.abs(result.solution - 5)).toBeLessThan(1e-3)
  })

  it('does not crash when the initial probe is non-finite (1/x at x=0)', () => {
    // Solver must survive a NaN/Infinity from evaluate() on the first
    // call and still return a structured result.
    const result = goalSeek({
      startValue: 0,
      target: 2,
      evaluate: (x) => 10 / x,
    })
    // Convergence is best-effort here (discontinuity at x=0); the
    // contract is just "no crash + structured result".
    expect(result).toMatchObject({
      converged: expect.any(Boolean),
      iterations: expect.any(Number),
    })
    expect(result.iterations).toBeGreaterThan(0)
  })

  it('rejects non-finite startValue without crashing', () => {
    const result = goalSeek({
      startValue: NaN,
      target: 100,
      evaluate: (x) => x,
    })
    expect(result.converged).toBe(false)
    expect(result.reason).toContain('Starting')
  })

  it('rejects non-finite target without crashing', () => {
    const result = goalSeek({
      startValue: 0,
      target: Number.POSITIVE_INFINITY,
      evaluate: (x) => x,
    })
    expect(result.converged).toBe(false)
    expect(result.reason).toContain('Target')
  })

  it('respects the custom epsilon', () => {
    const result = goalSeek({
      startValue: 0,
      target: Math.PI,
      evaluate: (x) => x,
      epsilon: 1e-10,
    })
    expect(result.converged).toBe(true)
    expect(Math.abs(result.resultValue - Math.PI)).toBeLessThan(1e-9)
  })

  it('cancel-flow contract: solver is pure — no input mutation', () => {
    const evals: number[] = []
    const params = {
      startValue: 100,
      target: 200,
      evaluate: (x: number) => { evals.push(x); return x * 2 },
    }
    const original = { ...params }
    goalSeek(params)
    expect(params.startValue).toBe(original.startValue)
    expect(params.target).toBe(original.target)
    expect(evals.length).toBeGreaterThan(0)
  })
})
