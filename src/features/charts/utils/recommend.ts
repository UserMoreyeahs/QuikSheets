/**
 * Excel-style "Recommended Charts" — picks up to 4 chart presets that best fit
 * the shape of the user's data.
 *
 * The recommender uses cheap heuristics: column type ratios, row counts, and
 * series counts to pick the best chart types without an AI call.
 */

import type { ChartKind, ChartConfig } from '../types'
import type { RangeMatrix } from './toEChartsOption'

export interface ChartRecommendation {
  kind: ChartKind
  /** Short heading shown on the recommendation card (e.g. "Clustered Bar"). */
  title: string
  /** One-sentence reason for the suggestion. */
  rationale: string
  /** Pre-built config to use if the user clicks the recommendation. */
  config: ChartConfig
}

function isNumericValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false
  if (typeof v === 'number') return Number.isFinite(v)
  const n = Number(v)
  return !Number.isNaN(n) && Number.isFinite(n)
}

function looksLikeDate(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false
  const s = String(v)
  return !isNaN(Date.parse(s)) && /[-/]/.test(s)
}

function classifyColumns(matrix: RangeMatrix, hasHeader: boolean): {
  numericCols: number[]
  textCols: number[]
  dateCols: number[]
} {
  const dataRows = hasHeader ? matrix.slice(1) : matrix
  const colCount = matrix[0]?.length ?? 0
  const numericCols: number[] = []
  const textCols: number[] = []
  const dateCols: number[] = []
  for (let c = 0; c < colCount; c++) {
    let numeric = 0, total = 0, dateCount = 0
    for (let r = 0; r < Math.min(dataRows.length, 30); r++) {
      const v = dataRows[r]?.[c]
      if (v === null || v === undefined || v === '') continue
      total++
      if (isNumericValue(v)) numeric++
      if (looksLikeDate(v)) dateCount++
    }
    if (total > 0 && dateCount / total >= 0.6) dateCols.push(c)
    else if (total > 0 && numeric / total >= 0.6) numericCols.push(c)
    else textCols.push(c)
  }
  return { numericCols, textCols, dateCols }
}

export function recommendCharts(
  matrix: RangeMatrix,
  hasHeader: boolean
): ChartRecommendation[] {
  const dataRows = hasHeader ? matrix.slice(1) : matrix
  const rowCount = dataRows.length
  if (rowCount < 1) return []

  const { numericCols, textCols, dateCols } = classifyColumns(matrix, hasHeader)
  if (numericCols.length === 0) return []

  const categoryCol = dateCols[0] ?? textCols[0] ?? 0
  const seriesCols = numericCols
  const recs: ChartRecommendation[] = []

  // 1) Clustered Bar / Stacked Bar
  if (seriesCols.length > 1) {
    recs.push({
      kind: 'stacked_bar',
      title: 'Stacked Bar',
      rationale: `Compares ${seriesCols.length} series across ${rowCount} categories in a stacked layout.`,
      config: { kind: 'stacked_bar', hasHeader, categoryColumn: categoryCol, seriesColumns: seriesCols, legend: true },
    })
  }
  recs.push({
    kind: 'bar',
    title: seriesCols.length > 1 ? 'Clustered Bar' : 'Bar',
    rationale: seriesCols.length > 1
      ? `Compares ${seriesCols.length} series side-by-side across ${rowCount} categories.`
      : `Shows ${rowCount} categories with one numeric series.`,
    config: { kind: 'bar', hasHeader, categoryColumn: categoryCol, seriesColumns: seriesCols, legend: seriesCols.length > 1 },
  })

  // 2) Line / Area — for ≥ 6 points (trend / time series)
  if (rowCount >= 6) {
    recs.push({
      kind: dateCols.length > 0 ? 'area' : 'line',
      title: dateCols.length > 0 ? 'Area' : 'Line',
      rationale: dateCols.length > 0
        ? `Highlights trends over time with shaded area for ${rowCount} data points.`
        : `Highlights trends across ${rowCount} ordered data points.`,
      config: { kind: dateCols.length > 0 ? 'area' : 'line', hasHeader, categoryColumn: categoryCol, seriesColumns: seriesCols, legend: seriesCols.length > 1 },
    })
  }

  // 3) Pie / Doughnut — single series + few categories
  if (seriesCols.length === 1 && rowCount <= 8 && rowCount >= 2) {
    recs.push({
      kind: 'doughnut',
      title: 'Doughnut',
      rationale: `Shows the share of each of ${rowCount} categories with a modern doughnut style.`,
      config: { kind: 'doughnut', hasHeader, categoryColumn: categoryCol, seriesColumns: seriesCols, legend: true },
    })
  }

  // 4) Scatter — when both X and Y are numeric
  if (numericCols.length >= 2) {
    const xCol = numericCols[0] ?? 0
    const yCols = numericCols.slice(1)
    recs.push({
      kind: 'scatter',
      title: 'Scatter',
      rationale: `Reveals correlation between ${numericCols.length} numeric variables.`,
      config: { kind: 'scatter', hasHeader, categoryColumn: xCol, seriesColumns: yCols, legend: yCols.length > 1 },
    })
  }

  // 5) Combo — when multiple series (bar + line)
  if (seriesCols.length >= 2 && rowCount >= 4) {
    const lineColumns = seriesCols.slice(-1)
    recs.push({
      kind: 'combo',
      title: 'Combo (Bar + Line)',
      rationale: `Overlays bar and line for ${seriesCols.length} series — great for comparing metrics.`,
      config: { kind: 'combo', hasHeader, categoryColumn: categoryCol, seriesColumns: seriesCols, legend: true, lineColumns },
    })
  }

  // 6) Radar — small category count + multiple series
  if (seriesCols.length >= 2 && rowCount >= 3 && rowCount <= 12) {
    recs.push({
      kind: 'radar',
      title: 'Radar',
      rationale: `Compares ${seriesCols.length} metrics across ${rowCount} categories on a spider web.`,
      config: { kind: 'radar', hasHeader, categoryColumn: categoryCol, seriesColumns: seriesCols, legend: true },
    })
  }

  return recs.slice(0, 4)
}
