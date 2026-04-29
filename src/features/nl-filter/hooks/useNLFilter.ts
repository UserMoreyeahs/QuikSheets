'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { colIndexToLetter } from '@/lib/cellAddress'
import { useSheetStore } from '@/store/sheetStore'
import type { FilterOperator, FilterRule } from '@/types/sheet.types'

export interface NLFilterColumnSchema {
  index: number
  column: string
  header: string
  sampleValues: string[]
}

export interface NLFilterSampleRow {
  rowIndex: number
  values: Record<string, string | number | boolean | null>
}

interface ApiFilterRule {
  column: string
  operator: FilterOperator
  value: string
}

interface ApiFilterResponse {
  filters?: ApiFilterRule[]
  explanation?: string
}

interface CachedFilterResult {
  filters: FilterRule[]
  explanation: string
}

interface UseNLFilterOptions {
  columnSchema: NLFilterColumnSchema[]
  sampleData: NLFilterSampleRow[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function resolveColumnIndex(column: string, schema: NLFilterColumnSchema[]): number | null {
  const normalizedColumn = normalize(column)
  const byMatch = schema.find((item) => {
    const letter = colIndexToLetter(item.index)
    const candidates = [
      item.header,
      item.column,
      letter,
      `Column ${letter}`,
      `${item.index}`,
      `${item.index + 1}`,
    ]

    return candidates.some((candidate) => normalize(candidate) === normalizedColumn)
  })

  return byMatch?.index ?? null
}

function toFilterRules(filters: ApiFilterRule[] | undefined, schema: NLFilterColumnSchema[]): FilterRule[] {
  if (!filters) return []

  return filters
    .map((filter) => {
      const columnIndex = resolveColumnIndex(filter.column, schema)
      if (columnIndex === null) return null

      return {
        columnIndex,
        operator: filter.operator,
        value: filter.value ?? '',
      }
    })
    .filter((filter): filter is FilterRule => filter !== null)
}

function createCacheKey(query: string, columnSchema: NLFilterColumnSchema[]): string {
  return `${normalize(query)}::${columnSchema
    .map((column) => `${column.index}:${column.header}:${column.column}`)
    .join('|')}`
}

export function useNLFilter({ columnSchema, sampleData }: UseNLFilterOptions) {
  const { activeFilters, clearFilters, setActiveFilters } = useSheetStore()
  const [query, setQuery] = useState('')
  const [explanation, setExplanation] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const cacheRef = useRef(new Map<string, CachedFilterResult>())
  const hasAppliedFilterRef = useRef(false)

  const schemaSignature = useMemo(
    () => columnSchema.map((column) => `${column.index}:${column.header}:${column.column}`).join('|'),
    [columnSchema]
  )

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setExplanation('')
      setIsLoading(false)
      if (hasAppliedFilterRef.current) {
        clearFilters()
        hasAppliedFilterRef.current = false
      }
      return
    }

    const cacheKey = createCacheKey(trimmedQuery, columnSchema)
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setActiveFilters(cached.filters)
      setExplanation(cached.explanation)
      setIsLoading(false)
      hasAppliedFilterRef.current = true
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)

      try {
        const response = await fetch('/api/ai/filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            instruction: trimmedQuery,
            columnSchema,
            sampleData,
          }),
        })

        const data = (await response.json()) as ApiFilterResponse & { error?: string }
        if (!response.ok) {
          throw new Error(data.error || 'Unable to parse filter instruction.')
        }

        const filters = toFilterRules(data.filters, columnSchema)
        const nextExplanation = data.explanation ?? 'No clear filter rules detected.'
        cacheRef.current.set(cacheKey, { filters, explanation: nextExplanation })
        setActiveFilters(filters)
        setExplanation(nextExplanation)
        hasAppliedFilterRef.current = true
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setActiveFilters([])
        setExplanation('No clear filter rules detected.')
        hasAppliedFilterRef.current = true
      } finally {
        setIsLoading(false)
      }
    }, 800)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [clearFilters, columnSchema, sampleData, query, schemaSignature, setActiveFilters])

  const removeFilter = useCallback(
    (filterIndex: number) => {
      setActiveFilters(activeFilters.filter((_, index) => index !== filterIndex))
    },
    [activeFilters, setActiveFilters]
  )

  const clearAll = useCallback(() => {
    setQuery('')
    setExplanation('')
    clearFilters()
    hasAppliedFilterRef.current = false
  }, [clearFilters])

  return {
    activeFilters,
    clearAll,
    explanation,
    isExpanded,
    isLoading,
    query,
    removeFilter,
    setIsExpanded,
    setQuery,
  }
}
