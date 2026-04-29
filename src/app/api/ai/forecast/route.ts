import { NextResponse } from 'next/server'
import { z } from 'zod'
import { publicEnv } from '@/lib/env'

const requestSchema = z.object({
  series: z.array(z.number()).min(3).max(120),
  horizon: z.number().int().min(1).max(24).default(3),
})

export async function POST(req: Request) {
  if (!publicEnv.NEXT_PUBLIC_FF_FORECAST) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { series, horizon } = parsed.data

  // Deterministic fallback: simple linear regression forecast + naive
  // anomaly detection (>2 stddev from mean).
  const { forecast, confidence } = linearForecast(series, horizon)
  const anomalies = detectAnomalies(series)

  return NextResponse.json({ forecast, confidence, anomalies })
}

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

  // Confidence: 1 - normalized std of residuals (clamped 0..1)
  const residuals = series.map((y, i) => (y - (intercept + slope * i)) ** 2)
  const rmse = Math.sqrt(residuals.reduce((a, b) => a + b, 0) / n)
  const range = Math.max(1, Math.max(...series) - Math.min(...series))
  const confidence = Math.max(0, Math.min(1, 1 - rmse / range))

  return { forecast, confidence }
}

function detectAnomalies(series: number[]): number[] {
  const n = series.length
  const mean = series.reduce((a, b) => a + b, 0) / n
  const variance = series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)
  if (std === 0) return []
  const indexes: number[] = []
  for (let i = 0; i < n; i++) {
    const value = series[i] ?? 0
    if (Math.abs(value - mean) > 2 * std) indexes.push(i)
  }
  return indexes
}
