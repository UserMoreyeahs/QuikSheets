'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { colIndexToLetter } from '@/lib/cellAddress'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { analyzeColumn, type ColumnAnalysis } from '@/features/column-dna/utils/columnAnalyzer'
import type { Sheet } from '@fortune-sheet/core'

export function useColumnDNA(sheet: Sheet | null | undefined) {
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [analysis, setAnalysis] = useState<ColumnAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const columnLabel = useMemo(
    () => (selectedColumn === null ? '' : colIndexToLetter(selectedColumn)),
    [selectedColumn]
  )

  const openPanel = useCallback((columnIndex: number) => {
    setSelectedColumn(columnIndex)
    setShowPanel(true)
  }, [])

  const closePanel = useCallback(() => {
    setShowPanel(false)
  }, [])

  useEffect(() => {
    if (!showPanel || selectedColumn === null || !sheet) return

    setIsLoading(true)
    const timer = window.setTimeout(() => {
      const matrix = getSheetMatrix(sheet)
      const values = matrix
        .slice(1)
        .map((row) => getCellDisplayValue(row?.[selectedColumn] ?? null))

      setAnalysis(analyzeColumn(values))
      setIsLoading(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [selectedColumn, sheet, showPanel])

  return {
    analysis,
    closePanel,
    columnLabel,
    isLoading,
    openPanel,
    selectedColumn,
    setSelectedColumn,
    setShowPanel,
    showPanel,
  }
}
