'use client'

import React, { useState } from 'react'
import { FORMAT_PRESETS } from '../constants/presets'
import type { CFDatePeriod, CFFormat } from '../types'

const DATE_PERIODS: { value: CFDatePeriod; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'last7Days', label: 'Last 7 Days' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'nextWeek', label: 'Next Week' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'nextMonth', label: 'Next Month' },
]

export interface CFInlineDialogProps {
  title: string
  type: 'value' | 'between' | 'text' | 'date' | 'topN' | 'topNPercent'
  onApply: (params: {
    value?: string
    value2?: string
    n?: number
    datePeriod?: CFDatePeriod
    format: CFFormat
  }) => void
  onCancel: () => void
}

export function CFInlineDialog({ title, type, onApply, onCancel }: CFInlineDialogProps) {
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')
  const [n, setN] = useState(10)
  const [datePeriod, setDatePeriod] = useState<CFDatePeriod>('today')
  const [selectedPreset, setSelectedPreset] = useState(0)

  const handleApply = () => {
    const preset = FORMAT_PRESETS[selectedPreset]
    const format: CFFormat = {
      fill: preset?.fill ?? '#FFC7CE',
      color: preset?.color ?? '#9C0006',
    }

    if (type === 'value' || type === 'text') {
      onApply({ value, format })
    } else if (type === 'between') {
      onApply({ value, value2, format })
    } else if (type === 'date') {
      onApply({ datePeriod, format })
    } else if (type === 'topN' || type === 'topNPercent') {
      onApply({ n, format })
    }
  }

  return (
    <div
      className="w-[320px] rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        {title}
      </h3>

      {/* Input area */}
      <div className="mb-3 flex flex-col gap-2">
        {(type === 'value' || type === 'text') && (
          <input
            type={type === 'value' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'value' ? 'Enter a value' : 'Enter text'}
            autoFocus
            className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        )}

        {type === 'between' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Min"
              autoFocus
              className="flex-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">and</span>
            <input
              type="number"
              value={value2}
              onChange={(e) => setValue2(e.target.value)}
              placeholder="Max"
              className="flex-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        )}

        {type === 'date' && (
          <select
            value={datePeriod}
            onChange={(e) => setDatePeriod(e.target.value as CFDatePeriod)}
            className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {DATE_PERIODS.map((dp) => (
              <option key={dp.value} value={dp.value}>
                {dp.label}
              </option>
            ))}
          </select>
        )}

        {(type === 'topN' || type === 'topNPercent') && (
          <input
            type="number"
            min={1}
            value={n}
            onChange={(e) => setN(parseInt(e.target.value) || 10)}
            autoFocus
            className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        )}
      </div>

      {/* Format preset picker */}
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          with
        </p>
        <div className="flex gap-1.5">
          {FORMAT_PRESETS.map((preset, idx) => (
            <button
              key={preset.label}
              type="button"
              title={preset.label}
              onClick={() => setSelectedPreset(idx)}
              className={
                'h-7 w-7 rounded border-2 transition-all ' +
                (idx === selectedPreset
                  ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                  : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500')
              }
              style={{ backgroundColor: preset.fill }}
            >
              <span
                className="text-[10px] font-bold"
                style={{ color: preset.color }}
              >
                A
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          OK
        </button>
      </div>
    </div>
  )
}
