'use client'

/**
 * ForecastPanel
 * --------------------------------------------------------------------------
 * AI Forecasting workflow built on /api/ai/forecast.
 *
 *   1. User selects a column / range of historical values (e.g. monthly revenue).
 *   2. Panel reads the selected numeric series, forecasts N future periods,
 *      detects anomalies, and renders a chart with both history + forecast +
 *      anomaly markers.
 *   3. "Apply" appends the forecast values into the cells just below the
 *      selection so users can see the prediction sit alongside their data.
 *
 * Notes:
 *   - The backend /api/ai/forecast endpoint is gated behind
 *     NEXT_PUBLIC_FF_FORECAST.  When the flag is off the route returns 404 —
 *     we fall back to a fully client-side linear forecast so the panel still
 *     works in dev and for users without the flag.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import ReactECharts from 'echarts-for-react'
import { Sparkles, X, TrendingUp, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useForecastStore } from '@/features/forecasting/store/forecastStore'
import { useSheetStore } from '@/store/sheetStore'
import { cloneSheetWithData, getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import type { Cell } from '@fortune-sheet/core'

interface ForecastResponse {
  forecast: number[]
  confidence: number
  anomalies: number[]
}

// ── client-side fallback ────────────────────────────────────────────────────
function localForecast(series: number[], horizon: number): ForecastResponse {
  const n = series.length
  if (n < 3) return { forecast: [], confidence: 0, anomalies: [] }
  const xMean = (n - 1) / 2
  const yMean = series.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const y = series[i] ?? 0
    num += (i - xMean) * (y - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean
  const forecast = Array.from({ length: horizon }, (_, k) => intercept + slope * (n + k))
  const residuals = series.map((y, i) => (y - (intercept + slope * i)) ** 2)
  const rmse = Math.sqrt(residuals.reduce((a, b) => a + b, 0) / n)
  const range = Math.max(1, Math.max(...series) - Math.min(...series))
  const confidence = Math.max(0, Math.min(1, 1 - rmse / range))
  // anomaly: > 2 stddev from mean
  const variance = series.reduce((s, v) => s + (v - yMean) ** 2, 0) / n
  const std = Math.sqrt(variance)
  const anomalies: number[] = []
  if (std > 0) {
    for (let i = 0; i < n; i++) {
      if (Math.abs((series[i] ?? 0) - yMean) > 2 * std) anomalies.push(i)
    }
  }
  return { forecast, confidence, anomalies }
}

// ── series extraction ──────────────────────────────────────────────────────
function getSelectedSeries(
  state: ReturnType<typeof useSheetStore.getState>
): { values: number[]; rowEnd: number; col: number; rowStart: number } | null {
  const cell = state.selectedCell
  const range = state.selectedRange
  if (!cell) return null
  const activeSheet = state.gridSheets.find((s) => s.status === 1) ?? state.gridSheets[0]
  if (!activeSheet) return null

  let rowStart = cell.row, rowEnd = cell.row, col = cell.col
  if (range) {
    rowStart = Math.min(range.start.row, range.end.row)
    rowEnd   = Math.max(range.start.row, range.end.row)
    col      = Math.min(range.start.col, range.end.col)
  }

  const matrix = getSheetMatrix(activeSheet)
  const values: number[] = []
  for (let r = rowStart; r <= rowEnd; r++) {
    const display = getCellDisplayValue(matrix[r]?.[col] ?? null)
    if (display === null || display === undefined || display === '') continue
    const n = Number(display)
    if (Number.isFinite(n)) values.push(n)
  }
  return { values, rowStart, rowEnd, col }
}

// ── component ──────────────────────────────────────────────────────────────
export function ForecastPanel() {
  const isOpen = useForecastStore((s) => s.isOpen)
  const close = useForecastStore((s) => s.close)
  const sheetState = useSheetStore()

  const [horizon, setHorizon] = useState(3)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ForecastResponse | null>(null)

  const series = useMemo(() => getSelectedSeries(sheetState), [sheetState])

  useEffect(() => {
    if (isOpen) setResult(null)
  }, [isOpen])

  // ── chart option (must run before any early return) ────────────────────
  const chartOption = useMemo(() => {
    if (!series) return null
    const history = series.values
    const forecast = result?.forecast ?? []
    const anomalies = result?.anomalies ?? []
    const total = history.length + forecast.length

    const xAxis = Array.from({ length: total }, (_, i) =>
      i < history.length ? `t${i + 1}` : `→ t${i + 1}`
    )

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { bottom: 0 },
      grid: { left: 36, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category' as const, data: xAxis },
      yAxis: { type: 'value' as const },
      series: [
        {
          name: 'History',
          type: 'line' as const,
          data: [...history, ...Array.from({ length: forecast.length }, () => null)],
          smooth: true,
          markPoint: anomalies.length > 0
            ? {
                data: anomalies.map((idx) => ({
                  coord: [idx, history[idx] ?? 0],
                  itemStyle: { color: '#f43f5e' },
                  label: { show: false },
                })),
                symbol: 'pin',
                symbolSize: 24,
              }
            : undefined,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Forecast',
          type: 'line' as const,
          data: [
            ...Array.from({ length: history.length - 1 }, () => null),
            history[history.length - 1] ?? null,
            ...forecast,
          ],
          smooth: true,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { type: 'dashed' as const },
        },
      ],
    }
  }, [series, result])

  if (!isOpen) return null

  const ready = series !== null && series.values.length >= 3
  const tooFew = series !== null && series.values.length < 3

  function run() {
    if (!series || !ready) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai/forecast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ series: series.values, horizon }),
        })
        if (res.ok) {
          const json = (await res.json()) as ForecastResponse
          setResult(json)
        } else {
          // fallback to client-side
          setResult(localForecast(series.values, horizon))
        }
      } catch {
        setResult(localForecast(series.values, horizon))
      }
    })
  }

  function apply() {
    if (!series || !result) return
    const { gridSheets, replaceGridSheets } = useSheetStore.getState()
    const activeSheetIdx = gridSheets.findIndex((s) => s.status === 1)
    const activeSheet = activeSheetIdx >= 0 ? gridSheets[activeSheetIdx] : gridSheets[0]
    if (!activeSheet) return
    const matrix = getSheetMatrix(activeSheet)
    const next = matrix.map((row) => [...(row ?? [])])

    let writeRow = series.rowEnd + 1
    for (const value of result.forecast) {
      let row = next[writeRow]
      if (!row) { row = []; next[writeRow] = row }
      const display = Number.isFinite(value)
        ? Number(value.toFixed(2))
        : 0
      const cell: Cell = { v: display, m: String(display), it: 1 }
      row[series.col] = cell
      writeRow++
    }

    const targetIdx = activeSheetIdx >= 0 ? activeSheetIdx : 0
    const nextSheets = gridSheets.map((s, i) =>
      i === targetIdx ? cloneSheetWithData(s, next) : s
    )
    replaceGridSheets(nextSheets)
    toast.success(`Inserted ${result.forecast.length} forecasted values.`)
    close()
  }

  return (
    <div className="fixed right-4 top-[140px] z-50 w-[480px] rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Forecasting Agent</span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close forecast panel"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {ready
            ? <>Selected series: <span className="font-mono text-zinc-700 dark:text-zinc-200">{series.values.length}</span> numeric values</>
            : tooFew
              ? <>Select at least <strong>3</strong> numeric cells in a column.</>
              : <>Select a column of historical numeric values to forecast.</>}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="text-[12px] text-zinc-700 dark:text-zinc-200">Periods to forecast</label>
          <input
            type="number"
            min={1}
            max={24}
            value={horizon}
            onChange={(e) => setHorizon(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[12px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={run}
            disabled={!ready || pending}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {pending ? 'Forecasting…' : 'Run'}
          </button>
        </div>

        {result && chartOption && (
          <>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
              <ReactECharts option={chartOption} style={{ height: 220, width: '100%' }} notMerge lazyUpdate />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
              <Stat label="Forecast Δ"
                value={result.forecast.length > 0
                  ? formatDelta(series!.values[series!.values.length - 1] ?? 0, result.forecast[result.forecast.length - 1] ?? 0)
                  : '—'}
              />
              <Stat label="Anomalies" value={String(result.anomalies.length)} />
            </div>
            {result.anomalies.length > 0 && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                <div className="flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-3 w-3" />
                  {result.anomalies.length} anomal{result.anomalies.length === 1 ? 'y' : 'ies'} detected
                </div>
                <div className="mt-0.5 font-mono">
                  Index{result.anomalies.length === 1 ? '' : 'es'}: {result.anomalies.join(', ')}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <button
          type="button"
          onClick={close}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!result}
          className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Apply forecast
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{value}</div>
    </div>
  )
}

function formatDelta(start: number, end: number): string {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—'
  if (start === 0) return end > 0 ? '+∞%' : end < 0 ? '−∞%' : '0%'
  const pct = ((end - start) / Math.abs(start)) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}
