'use client'

/**
 * WidgetEditDialog — per-widget configuration modal.
 *
 * Renders a different form body depending on widget.kind (kpi / chart / text / table).
 * Parent passes the current widget and a save callback.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Widget, KpiWidget, ChartWidget, TextWidget, TableWidget } from '../types'

interface Props {
  widget: Widget
  onSave: (updates: Partial<Widget>) => void
  onClose: () => void
}

export function WidgetEditDialog({ widget, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
            Edit {widget.kind === 'kpi' ? 'KPI' : widget.kind} Widget
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {widget.kind === 'kpi' && (
            <KpiForm widget={widget} onSave={onSave} onClose={onClose} />
          )}
          {widget.kind === 'chart' && (
            <ChartForm widget={widget} onSave={onSave} onClose={onClose} />
          )}
          {widget.kind === 'text' && (
            <TextForm widget={widget} onSave={onSave} onClose={onClose} />
          )}
          {widget.kind === 'table' && (
            <TableForm widget={widget} onSave={onSave} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'

const selectCls =
  'w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12px] outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'

function FormFooter({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        Save
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI form
// ---------------------------------------------------------------------------

function KpiForm({
  widget,
  onSave,
  onClose,
}: {
  widget: KpiWidget
  onSave: (updates: Partial<KpiWidget>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(widget.title)
  const [range, setRange] = useState(widget.range)
  const [aggregate, setAggregate] = useState(widget.aggregate)
  const [format, setFormat] = useState(widget.format)
  const [deltaRange, setDeltaRange] = useState(widget.delta?.range ?? '')
  const [deltaLabel, setDeltaLabel] = useState(widget.delta?.label ?? '')

  useEffect(() => {
    setTitle(widget.title)
    setRange(widget.range)
    setAggregate(widget.aggregate)
    setFormat(widget.format)
    setDeltaRange(widget.delta?.range ?? '')
    setDeltaLabel(widget.delta?.label ?? '')
  }, [widget])

  function save() {
    const updates: Partial<KpiWidget> = {
      title,
      range,
      aggregate,
      format,
      // exactOptionalPropertyTypes: only include `delta` when set; never assign `undefined`.
      ...(deltaRange.trim()
        ? { delta: { range: deltaRange.trim(), label: deltaLabel.trim() || 'vs previous' } }
        : {}),
    }
    onSave(updates)
    onClose()
  }

  return (
    <>
      <Field label="Title">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Value range">
        <input
          className={cn(inputCls, 'font-mono')}
          placeholder="B2:B100"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        />
      </Field>
      <Field label="Aggregate">
        <select
          className={selectCls}
          value={aggregate}
          onChange={(e) => setAggregate(e.target.value as KpiWidget['aggregate'])}
        >
          <option value="sum">Sum</option>
          <option value="avg">Average</option>
          <option value="count">Count</option>
          <option value="min">Min</option>
          <option value="max">Max</option>
        </select>
      </Field>
      <Field label="Format">
        <select
          className={selectCls}
          value={format}
          onChange={(e) => setFormat(e.target.value as KpiWidget['format'])}
        >
          <option value="number">Number</option>
          <option value="currency">Currency ($)</option>
          <option value="percent">Percent (%)</option>
        </select>
      </Field>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Delta (optional)
      </div>
      <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-2">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">
            Comparison range
          </label>
          <input
            className={cn(inputCls, 'font-mono')}
            placeholder="B2:B100 (previous period)"
            value={deltaRange}
            onChange={(e) => setDeltaRange(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Label</label>
          <input
            className={inputCls}
            placeholder="vs last month"
            value={deltaLabel}
            onChange={(e) => setDeltaLabel(e.target.value)}
          />
        </div>
      </div>
      <FormFooter onSave={save} onClose={onClose} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Chart form
// ---------------------------------------------------------------------------

function ChartForm({
  widget,
  onSave,
  onClose,
}: {
  widget: ChartWidget
  onSave: (updates: Partial<ChartWidget>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(widget.title)
  const [range, setRange] = useState(widget.range)
  const [chartType, setChartType] = useState(widget.chartType)
  const [hasHeader, setHasHeader] = useState(widget.hasHeader)
  const [categoryColumn, setCategoryColumn] = useState(widget.categoryColumn)
  const [seriesText, setSeriesText] = useState(widget.seriesColumns.join(', '))

  useEffect(() => {
    setTitle(widget.title)
    setRange(widget.range)
    setChartType(widget.chartType)
    setHasHeader(widget.hasHeader)
    setCategoryColumn(widget.categoryColumn)
    setSeriesText(widget.seriesColumns.join(', '))
  }, [widget])

  function save() {
    const seriesColumns = seriesText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0)
    onSave({
      title,
      range,
      chartType,
      hasHeader,
      categoryColumn,
      seriesColumns: seriesColumns.length > 0 ? seriesColumns : [1],
    })
    onClose()
  }

  return (
    <>
      <Field label="Title">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Source range">
        <input
          className={cn(inputCls, 'font-mono')}
          placeholder="A1:E20"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        />
      </Field>
      <Field label="Chart type">
        <select
          className={selectCls}
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartWidget['chartType'])}
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
          <option value="area">Area</option>
          <option value="scatter">Scatter</option>
          <option value="doughnut">Doughnut</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-200 mb-3">
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={(e) => setHasHeader(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        First row is header
      </label>
      <Field label="Category column index (0-based)">
        <input
          className={inputCls}
          type="number"
          min={0}
          value={categoryColumn}
          onChange={(e) => setCategoryColumn(Number(e.target.value))}
        />
      </Field>
      <Field label="Series column indices (comma-separated)">
        <input
          className={cn(inputCls, 'font-mono')}
          placeholder="1, 2, 3"
          value={seriesText}
          onChange={(e) => setSeriesText(e.target.value)}
        />
      </Field>
      <FormFooter onSave={save} onClose={onClose} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Text form
// ---------------------------------------------------------------------------

function TextForm({
  widget,
  onSave,
  onClose,
}: {
  widget: TextWidget
  onSave: (updates: Partial<TextWidget>) => void
  onClose: () => void
}) {
  const [content, setContent] = useState(widget.content)

  useEffect(() => { setContent(widget.content) }, [widget])

  function save() {
    onSave({ content })
    onClose()
  }

  return (
    <>
      <Field label="Content (markdown supported)">
        <textarea
          className={cn(inputCls, 'h-40 resize-y font-mono')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="**Bold**, *italic*, # Heading, `code`"
        />
      </Field>
      <FormFooter onSave={save} onClose={onClose} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Table form
// ---------------------------------------------------------------------------

function TableForm({
  widget,
  onSave,
  onClose,
}: {
  widget: TableWidget
  onSave: (updates: Partial<TableWidget>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(widget.title)
  const [range, setRange] = useState(widget.range)
  const [hasHeader, setHasHeader] = useState(widget.hasHeader)
  const [maxRows, setMaxRows] = useState(widget.maxRows ?? 10)

  useEffect(() => {
    setTitle(widget.title)
    setRange(widget.range)
    setHasHeader(widget.hasHeader)
    setMaxRows(widget.maxRows ?? 10)
  }, [widget])

  function save() {
    onSave({ title, range, hasHeader, maxRows })
    onClose()
  }

  return (
    <>
      <Field label="Title">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Source range">
        <input
          className={cn(inputCls, 'font-mono')}
          placeholder="A1:F50"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-200 mb-3">
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={(e) => setHasHeader(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        First row is header
      </label>
      <Field label="Max rows">
        <input
          className={inputCls}
          type="number"
          min={1}
          max={500}
          value={maxRows}
          onChange={(e) => setMaxRows(Number(e.target.value))}
        />
      </Field>
      <FormFooter onSave={save} onClose={onClose} />
    </>
  )
}
