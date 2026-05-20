'use client'

/**
 * ChartBuilder
 * --------------------------------------------------------------------------
 * Modal that lets the user pick a source range, chart kind and columns,
 * shows a live preview, and inserts the chart into the floating ChartsLayer
 * panel on Apply.
 *
 * The range is pre-filled from the user's current selection if any.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  X, BarChart3, LineChart, PieChart, Sparkles, RefreshCw,
  ScatterChart, AreaChart, Layers, Grid3x3,
} from 'lucide-react'
import { toast } from 'sonner'
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { ChartRenderer } from '@/features/charts/components/ChartRenderer'
import {
  boundsToA1,
  detectContiguousDataBlock,
  getRangeMatrix,
  parseA1Range,
  rangeHasNumericData,
} from '@/features/charts/utils/rangeUtils'
import { recommendCharts } from '@/features/charts/utils/recommend'
import type { ChartKind, ChartConfig } from '@/features/charts/types'
import type { RangeMatrix } from '@/features/charts/utils/toEChartsOption'
import { cn } from '@/lib/utils'

interface KindOption {
  kind: ChartKind
  label: string
  icon: React.ReactNode
}

const KINDS: KindOption[] = [
  { kind: 'bar',         label: 'Bar',         icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'stacked_bar', label: 'Stacked',     icon: <Layers     className="h-4 w-4" /> },
  { kind: 'line',        label: 'Line',        icon: <LineChart  className="h-4 w-4" /> },
  { kind: 'area',        label: 'Area',        icon: <AreaChart  className="h-4 w-4" /> },
  { kind: 'pie',         label: 'Pie',         icon: <PieChart   className="h-4 w-4" /> },
  { kind: 'doughnut',    label: 'Doughnut',    icon: <PieChart   className="h-4 w-4" /> },
  { kind: 'scatter',     label: 'Scatter',     icon: <ScatterChart className="h-4 w-4" /> },
  { kind: 'combo',       label: 'Combo',       icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'radar',       label: 'Radar',       icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'waterfall',   label: 'Waterfall',   icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'funnel',      label: 'Funnel',      icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'treemap',     label: 'Treemap',     icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'gauge',       label: 'Gauge',       icon: <BarChart3  className="h-4 w-4" /> },
  { kind: 'heatmap',     label: 'Heatmap',     icon: <Grid3x3    className="h-4 w-4" /> },
]

export function ChartBuilder() {
  const open = useChartPanelStore((s) => s.builderOpen)
  const initialKind = useChartPanelStore((s) => s.initialKind)
  const closeBuilder = useChartPanelStore((s) => s.closeBuilder)
  const addChart = useChartPanelStore((s) => s.addChart)

  const { gridSheets, selectedCell, selectedRange } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const activeSheet = useMemo(() => gridSheets.find((s) => s.status === 1) ?? gridSheets[0], [gridSheets])

  // ── form state ────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'recommended' | 'all'>('recommended')
  const [kind, setKind] = useState<ChartKind>('bar')
  const [hasHeader, setHasHeader] = useState(true)
  const [name, setName] = useState('Chart')
  const [rangeText, setRangeText] = useState('')
  const [categoryColumn, setCategoryColumn] = useState(0)
  const [seriesColumns, setSeriesColumns] = useState<number[]>([1])

  // pre-fill range from current selection when modal opens.
  // Excel-style: if user picked a single cell or no cell, expand outward to
  // the contiguous data block around (0, 0) or the seed cell.
  useEffect(() => {
    if (!open || !activeSheet) return

    let prefill = ''
    if (selectedRange) {
      const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
      const er = Math.max(selectedRange.start.row, selectedRange.end.row)
      const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
      const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
      // single-cell range → treat as no real selection and auto-detect
      if (sr === er && sc === ec) {
        const detected = detectContiguousDataBlock(activeSheet, sr, sc)
        prefill = detected ? boundsToA1(detected) : boundsToA1({ rowStart: sr, rowEnd: sr + 4, colStart: sc, colEnd: sc + 2 })
      } else {
        prefill = boundsToA1({ rowStart: sr, rowEnd: er, colStart: sc, colEnd: ec })
      }
    } else if (selectedCell) {
      const detected = detectContiguousDataBlock(activeSheet, selectedCell.row, selectedCell.col)
      prefill = detected
        ? boundsToA1(detected)
        : boundsToA1({ rowStart: selectedCell.row, rowEnd: selectedCell.row + 4, colStart: selectedCell.col, colEnd: selectedCell.col + 2 })
    } else {
      // default — find any data block on the sheet, fallback to A1:C10
      const detected = detectContiguousDataBlock(activeSheet, 0, 0)
      prefill = detected ? boundsToA1(detected) : 'A1:C10'
    }

    setRangeText(prefill)
    // R8.3 — when the builder is opened from an Insert-tab sub-dropdown
    // (Column/Bar, Line/Area, etc.) the store carries the user's chosen
    // chart kind. Skip to the "all" tab so the kind picker is visible
    // with the choice pre-applied.
    if (initialKind) {
      setKind(initialKind)
      setTab('all')
    } else {
      setKind('bar')
      setTab('recommended')
    }
    setHasHeader(true)
    setName('Chart')
    setCategoryColumn(0)
    setSeriesColumns([1])
  }, [open, initialKind, selectedCell, selectedRange, activeSheet])

  // ── derived: matrix + column headers ──────────────────────────────────
  const matrix = useMemo(() => {
    if (!activeSheet || !rangeText) return []
    return getRangeMatrix(activeSheet, rangeText)
  }, [activeSheet, rangeText])

  const columnCount = matrix[0]?.length ?? 0
  const rangeIsValid = parseA1Range(rangeText) !== null && columnCount > 0
  const hasNumeric = useMemo(
    () => (activeSheet ? rangeHasNumericData(activeSheet, rangeText) : false),
    [activeSheet, rangeText]
  )

  const headers = useMemo(() => {
    if (!hasHeader || matrix.length === 0) {
      return Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`)
    }
    return (matrix[0] ?? []).map((v, i) => (v === null || v === '' ? `Column ${i + 1}` : String(v)))
  }, [matrix, hasHeader, columnCount])

  // Excel-style recommended charts based on data shape
  const recommendations = useMemo(
    () => (rangeIsValid && hasNumeric ? recommendCharts(matrix as RangeMatrix, hasHeader) : []),
    [matrix, hasHeader, rangeIsValid, hasNumeric]
  )

  /**
   * Excel "Switch Row/Column" — swaps which axis the categories are on.
   * Implementation: rebuild the data orientation by transposing the source
   * matrix in the live preview only.  Original cells are untouched.
   */
  function switchRowColumn() {
    if (matrix.length === 0) return
    // The simpler "switch": move category to last seriesColumn and pick the
    // first non-numeric row as new category (i.e. transposed orientation).
    // We just swap categoryColumn with the first seriesColumn for now —
    // matches the most common Excel use-case of flipping the chart.
    const nextCategory = seriesColumns[0] ?? Math.min(1, columnCount - 1)
    const nextSeries = [categoryColumn, ...seriesColumns.filter((c) => c !== nextCategory)]
    setCategoryColumn(nextCategory)
    setSeriesColumns(Array.from(new Set(nextSeries)).filter((c) => c < columnCount && c !== nextCategory))
    if (nextSeries.length === 0) setSeriesColumns([Math.min(1, columnCount - 1)])
  }

  function applyRecommendation(config: ChartConfig) {
    setKind(config.kind)
    setHasHeader(config.hasHeader)
    setCategoryColumn(config.categoryColumn)
    setSeriesColumns(config.seriesColumns)
    setTab('all') // jump to the customisation tab so the user can tweak
  }

  // ── live preview config ────────────────────────────────────────────────
  const previewConfig: ChartConfig = useMemo(
    () => ({
      kind,
      title: name,
      hasHeader,
      categoryColumn,
      seriesColumns: seriesColumns.length > 0 ? seriesColumns : [Math.min(1, Math.max(0, columnCount - 1))],
      legend: true,
    }),
    [kind, name, hasHeader, categoryColumn, seriesColumns, columnCount]
  )

  // clamp column selectors when range changes
  useEffect(() => {
    if (columnCount === 0) return
    if (categoryColumn >= columnCount) setCategoryColumn(0)
    setSeriesColumns((cols) => {
      const filtered = cols.filter((c) => c < columnCount && c !== categoryColumn)
      if (filtered.length > 0) return filtered
      // pick any column other than category
      const fallback = columnCount > 1 ? (categoryColumn === 0 ? 1 : 0) : 0
      return [fallback]
    })
  }, [columnCount, categoryColumn])

  if (!open) return null

  function toggleSeriesColumn(idx: number) {
    setSeriesColumns((cols) => {
      if (cols.includes(idx)) {
        return cols.length > 1 ? cols.filter((c) => c !== idx) : cols
      }
      return [...cols, idx].sort((a, b) => a - b)
    })
  }

  function insert() {
    if (!rangeIsValid) {
      toast.error('Enter a valid range like A1:E10.')
      return
    }
    if (!activeSheetId) {
      toast.error('No active sheet.')
      return
    }
    // Anchor chart near the source range's top-right corner
    const anchorRow = selectedCell?.row ?? 0
    const anchorCol = (selectedCell?.col ?? 0) + (columnCount > 0 ? columnCount : 3)
    addChart({
      name: name.trim() || 'Chart',
      sourceRange: rangeText.trim().toUpperCase(),
      sheetId: activeSheetId,
      config: previewConfig,
      anchorRow,
      anchorCol,
    })
    toast.success('Chart inserted.')
    closeBuilder()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Insert Chart</h2>
          <button
            type="button"
            onClick={closeBuilder}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* tabs — Recommended / All charts */}
        <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
          {(['recommended', 'all'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                tab === t
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              {t === 'recommended' ? <><Sparkles className="h-3 w-3" /> Recommended Charts</> : 'All Charts'}
            </button>
          ))}
        </div>

        {/* Recommended tab body */}
        {tab === 'recommended' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!rangeIsValid ? (
              <div className="rounded-md border border-dashed border-zinc-300 px-6 py-12 text-center text-[13px] text-zinc-400 dark:border-zinc-700">
                Pick a valid range first. Try a block of headers + numbers.
              </div>
            ) : !hasNumeric ? (
              <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-6 py-12 text-center text-[12px] text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                The range <code className="font-mono">{rangeText}</code> doesn&apos;t contain numbers — Recommended Charts need numeric data to suggest a chart type.
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center text-[13px] text-zinc-400">No recommendations for this range.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {recommendations.map((rec, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyRecommendation(rec.config)}
                    className="group flex flex-col items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="border-b border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <ChartRenderer matrix={matrix} config={rec.config} height={140} />
                    </div>
                    <div className="space-y-0.5 p-3">
                      <div className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100">{rec.title}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{rec.rationale}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All charts tab body — original config + preview */}
        {tab === 'all' && (
        <div className="grid min-h-0 flex-1 grid-cols-[260px,1fr] gap-0">
          {/* left — config */}
          <div className="space-y-3 overflow-y-auto border-r border-zinc-200 p-4 dark:border-zinc-700">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Chart type
              </label>
              <div className="grid grid-cols-4 gap-1 max-h-[180px] overflow-y-auto">
                {KINDS.map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    onClick={() => setKind(k.kind)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5 transition-colors',
                      kind === k.kind
                        ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    {k.icon}
                    <span className="text-[10px] font-medium">{k.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="chart-name" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Title
              </label>
              <input
                id="chart-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label htmlFor="chart-range" className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Source range
              </label>
              <input
                id="chart-range"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="A1:E20"
                className={cn(
                  'w-full rounded-md border bg-white px-2 py-1.5 font-mono text-[12px] outline-none focus:ring-2 dark:bg-zinc-800 dark:text-zinc-100',
                  rangeIsValid
                    ? 'border-zinc-200 focus:border-blue-400 focus:ring-blue-100 dark:border-zinc-700'
                    : 'border-rose-300 focus:ring-rose-100',
                )}
              />
            </div>

            <label className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-200">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="h-3.5 w-3.5" />
              First row is header
            </label>

            {rangeIsValid && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Category column (X axis)
                  </label>
                  <select
                    value={categoryColumn}
                    onChange={(e) => setCategoryColumn(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Series (Y values)
                  </label>
                  <div className="space-y-1">
                    {headers.map((h, i) =>
                      i === categoryColumn ? null : (
                        <label key={i} className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={seriesColumns.includes(i)}
                            onChange={() => toggleSeriesColumn(i)}
                            className="h-3.5 w-3.5"
                          />
                          {h}
                        </label>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* right — preview */}
          <div className="bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Preview
              </span>
              <button
                type="button"
                onClick={switchRowColumn}
                disabled={!rangeIsValid || !hasNumeric || columnCount < 2}
                title="Swap categories and series — Excel-style flip"
                className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <RefreshCw className="h-3 w-3" />
                Switch Row/Column
              </button>
            </div>
            {!rangeIsValid ? (
              <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-zinc-300 text-[13px] text-zinc-400 dark:border-zinc-700">
                Enter a valid range to see the preview.
              </div>
            ) : !hasNumeric ? (
              <div className="flex h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50 px-6 text-center text-[12px] text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <div className="mb-1 text-[13px] font-semibold">No numeric data found</div>
                <div>The range <code className="font-mono">{rangeText}</code> doesn&apos;t contain any numbers to plot.</div>
                <div className="mt-1 text-amber-600 dark:text-amber-400">Add some numbers (or pick a different range) to continue.</div>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                <ChartRenderer matrix={matrix} config={previewConfig} height={360} />
              </div>
            )}
          </div>
        </div>
        )}

        {/* footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={closeBuilder}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={insert}
            disabled={!rangeIsValid || !hasNumeric}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Insert chart
          </button>
        </div>
      </div>
    </div>
  )
}
