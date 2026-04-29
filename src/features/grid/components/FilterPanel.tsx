'use client'

import React, { useEffect, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { colIndexToLetter } from '@/lib/cellAddress'
import type { FilterOperator, FilterRule } from '@/types/sheet.types'

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  totalColumns: number
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Is equal to' },
  { value: 'not_equals', label: 'Is not equal to' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'greater_equal', label: 'Greater than or equal' },
  { value: 'less_equal', label: 'Less than or equal' },
  { value: 'is_between', label: 'Is between' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
]

export function FilterPanel({ isOpen, onClose, totalColumns }: FilterPanelProps) {
  const { activeFilters, addFilter, removeFilter, clearFilters } = useSheetStore()
  const [selectedCol, setSelectedCol] = useState(0)
  const [operator, setOperator] = useState<FilterOperator>('contains')
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const columns = Array.from({ length: totalColumns }, (_, index) => ({
    index,
    label: `Column ${colIndexToLetter(index)}`,
  }))

  const needsValue2 = operator === 'is_between'
  const needsValue = operator !== 'is_empty' && operator !== 'is_not_empty'

  function handleAddFilter() {
    const rule: FilterRule = {
      columnIndex: selectedCol,
      operator,
      value,
      ...(needsValue2 ? { value2 } : {}),
    }

    addFilter(rule)
    setValue('')
    setValue2('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-[420px] rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Filter Rows</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-zinc-600">
            x
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">Add Filter Rule</div>

          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400"
          >
            {columns.map((column) => (
              <option key={column.index} value={column.index}>
                {column.label}
              </option>
            ))}
          </select>

          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as FilterOperator)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400"
          >
            {OPERATORS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          {needsValue && (
            <div className="flex gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value..."
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              {needsValue2 && (
                <input
                  type="text"
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                  placeholder="And..."
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddFilter}
            className="w-full rounded-lg border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 transition-colors hover:border-blue-400 hover:text-blue-600"
          >
            + Add this filter rule
          </button>
        </div>

        {activeFilters.length > 0 && (
          <div className="border-t border-zinc-100 px-5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Active filters ({activeFilters.length})</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-red-500 transition-colors hover:text-red-700"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-1.5">
              {activeFilters.map((filter, index) => (
                <div
                  key={`${filter.columnIndex}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2"
                >
                  <span className="text-xs text-zinc-600">
                    Col {colIndexToLetter(filter.columnIndex)}{' '}
                    <span className="text-zinc-400">
                      {OPERATORS.find((item) => item.value === filter.operator)?.label}
                    </span>{' '}
                    {filter.value && <span className="font-medium">{filter.value}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFilter(filter.columnIndex)}
                    className="ml-2 text-zinc-400 transition-colors hover:text-red-500"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              clearFilters()
              onClose()
            }}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            Clear and Close
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs text-white hover:bg-zinc-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
