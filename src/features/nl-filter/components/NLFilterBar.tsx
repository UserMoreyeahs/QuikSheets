'use client'

import { ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'
import { colIndexToLetter } from '@/lib/cellAddress'
import {
  useNLFilter,
  type NLFilterColumnSchema,
  type NLFilterSampleRow,
} from '@/features/nl-filter/hooks/useNLFilter'
import type { FilterOperator, FilterRule } from '@/types/sheet.types'

interface NLFilterBarProps {
  columnSchema: NLFilterColumnSchema[]
  sampleData: NLFilterSampleRow[]
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: '>',
  less_than: '<',
  greater_equal: '>=',
  less_equal: '<=',
  is_between: 'between',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  date_this_month: 'this month',
  date_last_n_days: 'last days',
  top_n: 'top',
}

function getColumnLabel(filter: FilterRule, schema: NLFilterColumnSchema[]): string {
  const column = schema.find((item) => item.index === filter.columnIndex)
  return column?.header || `Column ${colIndexToLetter(filter.columnIndex)}`
}

function getChipLabel(filter: FilterRule, schema: NLFilterColumnSchema[]): string {
  const operator = OPERATOR_LABELS[filter.operator]
  const value = filter.value ? ` ${filter.value}` : ''
  return `${getColumnLabel(filter, schema)} ${operator}${value}`.trim()
}

export function NLFilterBar({ columnSchema, sampleData }: NLFilterBarProps) {
  const {
    activeFilters,
    clearAll,
    explanation,
    isExpanded,
    isLoading,
    query,
    removeFilter,
    setIsExpanded,
    setQuery,
  } = useNLFilter({ columnSchema, sampleData })

  return (
    <section className="shrink-0 border-b border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="relative h-9 flex-1">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Filter with plain English, e.g. "status is Active" or "amount greater than 500"'
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 pr-9 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {isLoading && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400"
              aria-hidden="true"
            />
          )}
        </div>

        {activeFilters.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-xs font-medium text-zinc-500 transition-colors hover:text-red-600"
          >
            Clear all
          </button>
        )}
      </div>

      {(activeFilters.length > 0 || explanation) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {activeFilters.map((filter, index) => (
            <span
              key={`${filter.columnIndex}-${filter.operator}-${filter.value}-${index}`}
              className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs text-blue-700"
            >
              <span className="truncate">{getChipLabel(filter, columnSchema)}</span>
              <button
                type="button"
                onClick={() => removeFilter(index)}
                className="rounded-full p-0.5 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-800"
                aria-label="Remove filter"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}

          {explanation && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              What we understood:
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      )}

      {isExpanded && explanation && (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          {explanation}
        </div>
      )}
    </section>
  )
}
