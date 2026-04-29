import { describe, it, expect } from 'vitest'

// Mirror of the deterministic fallback logic in src/app/api/ai/forecast/route.ts
function linearForecast(series: number[], horizon: number): { forecast: number[]; confidence: number } {
  const n = series.length
  const xMean = (n - 1) / 2
  const yMean = series.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * ((series[i] ?? 0) - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean

  const forecast = Array.from({ length: horizon }, (_, k) => intercept + slope * (n + k))
  const residuals = series.map((y, i) => (y - (intercept + slope * i)) ** 2)
  const rmse = Math.sqrt(residuals.reduce((a, b) => a + b, 0) / n)
  const range = Math.max(1, Math.max(...series) - Math.min(...series))
  const confidence = Math.max(0, Math.min(1, 1 - rmse / range))

  return { forecast, confidence }
}

describe('linearForecast', () => {
  it('extrapolates a linear trend perfectly with confidence ~1', () => {
    const series = [10, 20, 30, 40, 50]
    const { forecast, confidence } = linearForecast(series, 3)
    expect(forecast).toEqual([60, 70, 80])
    expect(confidence).toBeCloseTo(1, 5)
  })

  it('returns lower confidence on noisy data', () => {
    const noisy = [10, 25, 12, 33, 18, 41]
    const { confidence } = linearForecast(noisy, 2)
    expect(confidence).toBeGreaterThanOrEqual(0)
    expect(confidence).toBeLessThan(1)
  })
})
