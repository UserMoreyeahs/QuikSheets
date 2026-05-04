'use client'

/**
 * PivotBuilder — Excel-style 4-quadrant drag-drop UI.
 * --------------------------------------------------------------------------
 *
 *   ┌────────────────────────────────┐  ┌─────────────────────────────────┐
 *   │ Source range, header toggle    │  │ Pivot fields (drag from here)   │
 *   │ ──────────────────────────────│  │ ☐ Region   ☐ Q1   ☐ Q2          │
 *   │ Filters     │  Columns         │  └─────────────────────────────────┘
 *   │ ───────────┼───────────────────│
 *   │ Rows        │  Values          │
 *   └────────────────────────────────┘
 *
 * Drag a field chip into any of the four zones — drop targets light up.
 * Values get an aggregation pill (Sum / Avg / Count / Min / Max) per item.
 * Filters get a multi-select checklist of the column's distinct values.
 *
 * Live preview re-renders as you reshape the layout — exactly like Excel's
 * PivotTable Fields task pane.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, ChevronDown, GripVertical, Sigma, Table, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import {
  pivot,
  type AggregateFn,
  type CalculatedField,
  type PivotConfig,
  type PivotFilter,
  type PivotValueSpec,
} from '@/features/pivot/pivotAggregator'
import {
  boundsToA1,
  detectContiguousDataBlock,
  getRangeMatrix,
  parseA1Range,
} from '@/features/charts/utils/rangeUtils'
import { cn } from '@/lib/utils'

const AGGREGATE_OPTIONS: AggregateFn[] = ['sum', 'avg', 'count', 'min', 'max']

type Zone = 'rows' | 'columns' | 'values' | 'filters'

interface DragPayload {
  sourceColumn: number
  fromZone: Zone | null
  /** Only set when re-dragging an existing values entry — preserves aggregate. */
  valueIdx?: number
  /** Only set when re-dragging an existing filter entry. */
  filterIdx?: number
}

const ZONE_LABEL: Record<Zone, string> = {
  filters: 'Filters',
  columns: 'Columns',
  rows:    'Rows',
  values:  'Values',
}

const ZONE_HINT: Record<Zone, string> = {
  filters: 'Drag fields here to filter rows.',
  columns: 'Drag fields here to spread values across columns.',
  rows:    'Drag fields here to group rows.',
  values:  'Drag numeric fields here to aggregate.',
}

export function PivotBuilder() {
  const open = usePivotUiStore((s) => s.builderOpen)
  const closeBuilder = usePivotUiStore((s) => s.closeBuilder)
  const addPivot = usePivotUiStore((s) => s.addPivot)

  const { gridSheets, selectedCell, selectedRange } = useSheetStore()
  const activeSheet = useMemo(
    () => gridSheets.find((s) => s.status === 1) ?? gridSheets[0],
    [gridSheets]
  )

  const [name, setName] = useState('Pivot table')
  const [rangeText, setRangeText] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [rowsZ, setRowsZ] = useState<number[]>([])
  const [colsZ, setColsZ] = useState<number[]>([])
  const [valuesZ, setValuesZ] = useState<PivotValueSpec[]>([])
  const [filtersZ, setFiltersZ] = useState<PivotFilter[]>([])
  const [calcFields, setCalcFields] = useState<CalculatedField[]>([])
  const [calcDialogOpen, setCalcDialogOpen] = useState(false)
  const [calcName, setCalcName] = useState('')
  const [calcExpr, setCalcExpr] = useState('')
  const dragPayload = useRef<DragPayload | null>(null)

  // ── pre-fill range + reset zones ────────────────────────────────────
  useEffect(() => {
    if (!open || !activeSheet) return
    let prefill = ''
    if (selectedRange) {
      const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
      const er = Math.max(selectedRange.start.row, selectedRange.end.row)
      const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
      const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
      if (sr === er && sc === ec) {
        const detected = detectContiguousDataBlock(activeSheet, sr, sc)
        prefill = detected ? boundsToA1(detected) : boundsToA1({ rowStart: sr, rowEnd: sr + 9, colStart: sc, colEnd: sc + 3 })
      } else {
        prefill = boundsToA1({ rowStart: sr, rowEnd: er, colStart: sc, colEnd: ec })
      }
    } else if (selectedCell) {
      const detected = detectContiguousDataBlock(activeSheet, selectedCell.row, selectedCell.col)
      prefill = detected
        ? boundsToA1(detected)
        : boundsToA1({ rowStart: selectedCell.row, rowEnd: selectedCell.row + 9, colStart: selectedCell.col, colEnd: selectedCell.col + 3 })
    } else {
      const detected = detectContiguousDataBlock(activeSheet, 0, 0)
      prefill = detected ? boundsToA1(detected) : 'A1:D20'
    }
    setRangeText(prefill)
    setName('Pivot table')
    setHasHeader(true)
    setRowsZ([])
    setColsZ([])
    setValuesZ([])
    setFiltersZ([])
    setCalcFields([])
  }, [open, selectedCell, selectedRange, activeSheet])

  // ── derived: matrix + headers + data rows ───────────────────────────
  const matrix = useMemo(() => {
    if (!activeSheet || !rangeText) return [] as (string | number | null)[][]
    return getRangeMatrix(activeSheet, rangeText)
  }, [activeSheet, rangeText])

  const columnCount = matrix[0]?.length ?? 0
  const rangeIsValid = parseA1Range(rangeText) !== null && columnCount > 0

  const headers = useMemo(() => {
    if (hasHeader && matrix.length > 0) {
      return (matrix[0] ?? []).map((v, i) => (v === null || v === '' ? `Column ${i + 1}` : String(v)))
    }
    return Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`)
  }, [matrix, hasHeader, columnCount])

  const dataRows = useMemo(
    () => (hasHeader && matrix.length > 0 ? matrix.slice(1) : matrix),
    [matrix, hasHeader]
  )

  // ── auto-seed default zones once range is valid ─────────────────────
  useEffect(() => {
    if (!rangeIsValid || columnCount === 0) return
    if (rowsZ.length + colsZ.length + valuesZ.length + filtersZ.length > 0) return
    // First non-numeric column → rows. First numeric column → values (sum).
    const isNumericCol = (c: number) => {
      let numeric = 0, total = 0
      for (let r = 0; r < Math.min(dataRows.length, 12); r++) {
        const v = dataRows[r]?.[c]
        if (v === null || v === undefined || v === '') continue
        total++
        if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) numeric++
      }
      return total > 0 && numeric / total >= 0.6
    }
    const numericCols: number[] = []
    const textCols: number[] = []
    for (let c = 0; c < columnCount; c++) (isNumericCol(c) ? numericCols : textCols).push(c)
    setRowsZ(textCols.slice(0, 1))
    setValuesZ(numericCols.slice(0, 1).map((c) => ({ column: c, aggregate: 'sum' })))
  }, [rangeIsValid, columnCount, dataRows, rowsZ.length, colsZ.length, valuesZ.length, filtersZ.length])

  // ── derived config + result ─────────────────────────────────────────
  const config: PivotConfig = useMemo(
    () => ({
      rows: rowsZ,
      columns: colsZ,
      values: valuesZ.map((v) => ({
        column: v.column,
        aggregate: v.aggregate,
        label: `${v.aggregate} of ${headers[v.column] ?? `Column ${v.column + 1}`}`,
      })),
      filters: filtersZ,
      ...(calcFields.length > 0 ? { calculatedFields: calcFields } : {}),
    }),
    [rowsZ, colsZ, valuesZ, filtersZ, headers, calcFields]
  )

  const result = useMemo(() => {
    if (!rangeIsValid) return null
    if (rowsZ.length + colsZ.length === 0 || valuesZ.length === 0) return null
    try { return pivot(dataRows, config) } catch { return null }
  }, [rangeIsValid, rowsZ.length, colsZ.length, valuesZ.length, dataRows, config])

  // ── distinct values per column (for filter pickers) ──────────────────
  const distinctByCol = useMemo(() => {
    const map = new Map<number, string[]>()
    return (col: number) => {
      const cached = map.get(col)
      if (cached) return cached
      const set = new Set<string>()
      for (const row of dataRows) {
        const v = row[col]
        if (v === null || v === undefined || v === '') continue
        set.add(String(v))
        if (set.size > 200) break
      }
      const list = Array.from(set).sort()
      map.set(col, list)
      return list
    }
  }, [dataRows])

  if (!open) return null

  // ── helpers — drag/drop ────────────────────────────────────────────
  function startDrag(e: React.DragEvent, payload: DragPayload) {
    dragPayload.current = payload
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(payload.sourceColumn))
  }

  function dropTo(zone: Zone) {
    const payload = dragPayload.current
    dragPayload.current = null
    if (!payload) return
    const { sourceColumn, fromZone, valueIdx, filterIdx } = payload

    // remove from previous zone if applicable
    const pluck = (curRows: number[]) => curRows.filter((c) => c !== sourceColumn)
    if (fromZone === 'rows') setRowsZ((r) => pluck(r))
    if (fromZone === 'columns') setColsZ((r) => pluck(r))
    if (fromZone === 'values' && valueIdx !== undefined)
      setValuesZ((vs) => vs.filter((_, i) => i !== valueIdx))
    if (fromZone === 'filters' && filterIdx !== undefined)
      setFiltersZ((fs) => fs.filter((_, i) => i !== filterIdx))

    // add to new zone
    if (zone === 'rows') setRowsZ((r) => (r.includes(sourceColumn) ? r : [...r, sourceColumn]))
    if (zone === 'columns') setColsZ((r) => (r.includes(sourceColumn) ? r : [...r, sourceColumn]))
    if (zone === 'values') {
      // values zone allows duplicates with different aggregates; preserve aggregate when re-dragging
      const existingAgg = fromZone === 'values' && valueIdx !== undefined ? valuesZ[valueIdx]?.aggregate ?? 'sum' : 'sum'
      setValuesZ((vs) => [...vs, { column: sourceColumn, aggregate: existingAgg }])
    }
    if (zone === 'filters') {
      setFiltersZ((fs) => fs.some((f) => f.column === sourceColumn) ? fs : [...fs, { column: sourceColumn, allowed: [] }])
    }
  }

  // ── insert ──────────────────────────────────────────────────────────
  function applyPivot() {
    if (!rangeIsValid) { toast.error('Enter a valid range like A1:D20.'); return }
    if (rowsZ.length + colsZ.length === 0) { toast.error('Drag at least one field into Rows or Columns.'); return }
    if (valuesZ.length === 0) { toast.error('Drag at least one field into Values.'); return }
    if (!result) { toast.error('Could not compute pivot.'); return }
    addPivot({
      name: name.trim() || 'Pivot table',
      sourceRange: rangeText.trim().toUpperCase(),
      hasHeader,
      config,
      result,
      headerLabels: headers,
      anchorRow: 0,
      anchorCol: columnCount > 0 ? columnCount + 1 : 4,
      offsetX: 120,
      offsetY: 120,
    })
    toast.success('Pivot inserted.')
    closeBuilder()
  }

  // helper to render a field chip
  function FieldChip({ col, fromZone, valueIdx, filterIdx, children, className }: {
    col: number; fromZone: Zone | null; valueIdx?: number; filterIdx?: number
    children: React.ReactNode; className?: string
  }) {
    return (
      <div
        draggable
        onDragStart={(e) => startDrag(e, { sourceColumn: col, fromZone, ...(valueIdx !== undefined ? { valueIdx } : {}), ...(filterIdx !== undefined ? { filterIdx } : {}) })}
        className={cn(
          'flex cursor-grab items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] font-medium shadow-sm hover:border-blue-400 hover:bg-blue-50 active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-blue-900/30',
          className,
        )}
      >
        <GripVertical className="h-3 w-3 shrink-0 text-zinc-400" />
        {children}
      </div>
    )
  }

  function DropZone({ zone, children }: { zone: Zone; children: React.ReactNode }) {
    const [over, setOver] = useState(false)
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); dropTo(zone) }}
        className={cn(
          'flex min-h-[64px] flex-col gap-1 rounded-md border-2 border-dashed p-1.5 transition-colors',
          over
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
            : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40',
        )}
      >
        {children}
      </div>
    )
  }

  function ZoneHeader({ zone }: { zone: Zone }) {
    return (
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span>{ZONE_LABEL[zone]}</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Insert Pivot Table</h2>
          </div>
          <button type="button" onClick={closeBuilder} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top — Source range + title */}
        <div className="grid grid-cols-[1fr,160px,auto] items-end gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Source range</label>
            <input
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              placeholder="A1:D20"
              className={cn(
                'w-full rounded-md border bg-white px-2 py-1.5 font-mono text-[12px] outline-none focus:ring-2 dark:bg-zinc-800 dark:text-zinc-100',
                rangeIsValid
                  ? 'border-zinc-200 focus:border-blue-400 focus:ring-blue-100 dark:border-zinc-700'
                  : 'border-rose-300 focus:ring-rose-100',
              )}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Title</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="h-3.5 w-3.5" />
            First row is header
          </label>
        </div>

        {/* Body — Field list (left) + drop zones (middle) + preview (right) */}
        <div className="grid flex-1 grid-cols-[180px,260px,1fr] overflow-hidden">

          {/* Field list */}
          <aside className="border-r border-zinc-200 p-3 overflow-y-auto dark:border-zinc-700">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pivot fields
            </div>
            <p className="mb-2 text-[10px] text-zinc-400">
              Drag a field into a zone →
            </p>
            <div className="space-y-1">
              {headers.map((h, i) => (
                <FieldChip key={i} col={i} fromZone={null}>
                  <span className="truncate">{h}</span>
                </FieldChip>
              ))}
              {headers.length === 0 && (
                <div className="text-[11px] italic text-zinc-400">Pick a valid range first.</div>
              )}
            </div>
          </aside>

          {/* 2x2 drop zones */}
          <section className="grid grid-rows-2 grid-cols-2 gap-2 border-r border-zinc-200 p-3 overflow-y-auto dark:border-zinc-700">
            {/* Filters */}
            <div>
              <ZoneHeader zone="filters" />
              <DropZone zone="filters">
                {filtersZ.length === 0 && (
                  <p className="text-[10px] italic text-zinc-400">{ZONE_HINT.filters}</p>
                )}
                {filtersZ.map((f, i) => (
                  <FilterChip
                    key={`f-${f.column}-${i}`}
                    field={f}
                    label={headers[f.column] ?? `Column ${f.column + 1}`}
                    distinct={distinctByCol(f.column)}
                    onRemove={() => setFiltersZ((fs) => fs.filter((_, idx) => idx !== i))}
                    onChange={(allowed) => setFiltersZ((fs) => fs.map((x, idx) => idx === i ? { ...x, allowed } : x))}
                    onDragStart={(e) => startDrag(e, { sourceColumn: f.column, fromZone: 'filters', filterIdx: i })}
                  />
                ))}
              </DropZone>
            </div>

            {/* Columns */}
            <div>
              <ZoneHeader zone="columns" />
              <DropZone zone="columns">
                {colsZ.length === 0 && (
                  <p className="text-[10px] italic text-zinc-400">{ZONE_HINT.columns}</p>
                )}
                {colsZ.map((col, i) => (
                  <FieldChip key={`c-${col}-${i}`} col={col} fromZone="columns">
                    <span className="truncate">{headers[col]}</span>
                    <button
                      type="button"
                      onClick={() => setColsZ((cs) => cs.filter((c) => c !== col))}
                      aria-label={`Remove ${headers[col]} from columns`}
                      className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </FieldChip>
                ))}
              </DropZone>
            </div>

            {/* Rows */}
            <div>
              <ZoneHeader zone="rows" />
              <DropZone zone="rows">
                {rowsZ.length === 0 && (
                  <p className="text-[10px] italic text-zinc-400">{ZONE_HINT.rows}</p>
                )}
                {rowsZ.map((col, i) => (
                  <FieldChip key={`r-${col}-${i}`} col={col} fromZone="rows">
                    <span className="truncate">{headers[col]}</span>
                    <button
                      type="button"
                      onClick={() => setRowsZ((rs) => rs.filter((c) => c !== col))}
                      aria-label={`Remove ${headers[col]} from rows`}
                      className="ml-auto rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </FieldChip>
                ))}
              </DropZone>
            </div>

            {/* Values */}
            <div>
              <ZoneHeader zone="values" />
              <DropZone zone="values">
                {valuesZ.length === 0 && (
                  <p className="text-[10px] italic text-zinc-400">{ZONE_HINT.values}</p>
                )}
                {valuesZ.map((v, i) => (
                  <ValueChip
                    key={`v-${v.column}-${i}`}
                    spec={v}
                    label={headers[v.column] ?? `Column ${v.column + 1}`}
                    onChange={(aggregate) => setValuesZ((vs) => vs.map((x, idx) => idx === i ? { ...x, aggregate } : x))}
                    onRemove={() => setValuesZ((vs) => vs.filter((_, idx) => idx !== i))}
                    onDragStart={(e) => startDrag(e, { sourceColumn: v.column, fromZone: 'values', valueIdx: i })}
                  />
                ))}
                {/* Calculated fields listed inside values zone */}
                {calcFields.map((cf, i) => (
                  <div
                    key={cf.id}
                    className="flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[12px] font-medium shadow-sm dark:border-emerald-700 dark:bg-emerald-900/30"
                  >
                    <Calculator className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate text-emerald-800 dark:text-emerald-200">{cf.name}</span>
                    <span className="ml-auto truncate font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                      {cf.expression}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCalcFields((fs) => fs.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${cf.name}`}
                      className="rounded p-0.5 text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </DropZone>
              <button
                type="button"
                onClick={() => { setCalcName(''); setCalcExpr(''); setCalcDialogOpen(true) }}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-dashed border-emerald-300 px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              >
                <Calculator className="h-3 w-3" /> Insert Calculated Field…
              </button>
            </div>
          </section>

          {/* Preview */}
          <section className="overflow-auto bg-zinc-50 p-3 dark:bg-zinc-800/30">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Preview
            </div>
            {result ? (
              <PivotPreview headers={headers} config={config} result={result} />
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 text-center text-[12px] text-zinc-400 dark:border-zinc-700">
                Drag at least one field into <strong>Rows</strong> or <strong>Columns</strong> and one numeric field into <strong>Values</strong>.
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button type="button" onClick={closeBuilder} className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={applyPivot}
            disabled={!result}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Insert pivot
          </button>
        </div>
      </div>

      {/* ── Calculated Field Dialog ─────────────────────────────────── */}
      {calcDialogOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setCalcDialogOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Insert Calculated Field</h3>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Name</label>
              <input
                value={calcName}
                onChange={(e) => setCalcName(e.target.value)}
                placeholder="e.g. Profit"
                className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Formula <span className="normal-case font-normal">(reference value field names)</span>
              </label>
              <input
                value={calcExpr}
                onChange={(e) => setCalcExpr(e.target.value)}
                placeholder="e.g. Revenue - Cost"
                className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 font-mono text-[13px] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* Available fields */}
            {valuesZ.length > 0 && (
              <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Available fields</div>
                <div className="flex flex-wrap gap-1">
                  {valuesZ.map((v, i) => {
                    const label = `${v.aggregate} of ${headers[v.column] ?? `Column ${v.column + 1}`}`
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCalcExpr((e) => (e ? `${e} ${label}` : label))}
                        className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-violet-700 shadow-sm hover:bg-violet-50 dark:bg-zinc-700 dark:text-violet-300 dark:hover:bg-zinc-600"
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCalcDialogOpen(false)}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!calcName.trim() || !calcExpr.trim()}
                onClick={() => {
                  setCalcFields((fs) => [...fs, { id: crypto.randomUUID(), name: calcName.trim(), expression: calcExpr.trim() }])
                  setCalcDialogOpen(false)
                  toast.success(`Calculated field "${calcName.trim()}" added.`)
                }}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function ValueChip({
  spec, label, onChange, onRemove, onDragStart,
}: {
  spec: PivotValueSpec
  label: string
  onChange: (a: AggregateFn) => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group flex cursor-grab items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[12px] font-medium shadow-sm hover:border-violet-400 active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-800"
    >
      <Sigma className="h-3 w-3 shrink-0 text-violet-500" />
      <span className="truncate">{label}</span>
      <select
        value={spec.aggregate}
        onChange={(e) => onChange(e.target.value as AggregateFn)}
        className="ml-auto rounded bg-violet-50 px-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700 outline-none dark:bg-violet-900/40 dark:text-violet-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {AGGREGATE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function FilterChip({
  field, label, distinct, onChange, onRemove, onDragStart,
}: {
  field: PivotFilter
  label: string
  distinct: string[]
  onChange: (allowed: string[]) => void
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group rounded border border-zinc-300 bg-white text-[12px] font-medium shadow-sm dark:border-zinc-600 dark:bg-zinc-800"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-grab items-center gap-1 px-2 py-1 active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3 shrink-0 text-zinc-400" />
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {field.allowed.length === 0 ? 'all' : `${field.allowed.length} sel`}
        </span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} />
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove() }} aria-label={`Remove ${label} filter`} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700">
          <X className="h-3 w-3" />
        </button>
      </button>
      {open && (
        <div className="max-h-40 overflow-y-auto border-t border-zinc-200 px-2 py-1 dark:border-zinc-700">
          {distinct.length === 0 && <div className="text-[10px] italic text-zinc-400">no values</div>}
          {distinct.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={field.allowed.includes(v)}
                onChange={(e) => onChange(e.target.checked ? [...field.allowed, v] : field.allowed.filter((x) => x !== v))}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-3 w-3"
              />
              <span className="truncate">{v}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function PivotPreview({
  headers, config, result,
}: {
  headers: string[]
  config: PivotConfig
  result: ReturnType<typeof pivot>
}) {
  const hasCols = (config.columns?.length ?? 0) > 0
  const numValues = config.values.length
  const colKeys = result.columnKeys

  return (
    <div className="overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="min-w-full text-[11px]">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          {/* When we have column dimensions, render multi-level headers */}
          {hasCols && (
            <tr>
              {config.rows.map((c) => (
                <th key={`r-h-${c}`} rowSpan={2} className="border-b border-zinc-200 px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  {headers[c]}
                </th>
              ))}
              {colKeys.map((ck, i) => (
                <th key={`ck-${i}`} colSpan={numValues} className="border-b border-l border-zinc-200 px-3 py-1.5 text-center font-medium text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  {ck.join(' / ')}
                </th>
              ))}
            </tr>
          )}
          <tr>
            {!hasCols && config.rows.map((c) => (
              <th key={`r-h-${c}`} className="border-b border-zinc-200 px-3 py-1.5 text-left font-medium text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {headers[c]}
              </th>
            ))}
            {hasCols
              ? colKeys.flatMap((_ck, ci) =>
                  config.values.map((v, vi) => (
                    <th key={`v-${ci}-${vi}`} className="border-b border-l border-zinc-200 px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      {v.label}
                    </th>
                  ))
                )
              : config.values.map((v, vi) => (
                  <th key={`v-${vi}`} className="border-b border-l border-zinc-200 px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    {v.label}
                  </th>
                ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <tr><td colSpan={config.rows.length + (hasCols ? colKeys.length * numValues : numValues)} className="px-3 py-6 text-center text-zinc-400">No data.</td></tr>
          ) : result.rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
              {row.keys.map((k, ki) => (
                <td key={`k-${ki}`} className="border-b border-zinc-100 px-3 py-1 dark:border-zinc-800">
                  {k || <span className="text-zinc-400">(empty)</span>}
                </td>
              ))}
              {row.valuesByCol.flatMap((colVals, ci) =>
                colVals.map((v, vi) => (
                  <td key={`v-${ci}-${vi}`} className="border-b border-l border-zinc-100 px-3 py-1 text-right font-mono dark:border-zinc-800">
                    {Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
