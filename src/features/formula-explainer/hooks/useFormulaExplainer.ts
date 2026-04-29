'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCellDisplayValue, getCellFromSheet } from '@/lib/fortuneSheet'
import { fromCellNotation } from '@/lib/cellAddress'
import { useWorkbookStore } from '@/store/workbookStore'
import { parseFormulaReferences } from '@/features/formula-explainer/utils/formulaParser'
import type { Sheet } from '@fortune-sheet/core'

export interface HoveredFormulaCell {
  row: number
  col: number
  sheetIndex: number
  formula: string
  anchor: { left: number; top: number }
}

interface FormulaExplanation {
  explanation: string
  dependencies: string[]
  sensitivityNote: string
}

function hashFormula(formula: string): string {
  let hash = 0
  for (let index = 0; index < formula.length; index += 1) {
    hash = (hash << 5) - hash + formula.charCodeAt(index)
    hash |= 0
  }
  return `${hash}`
}

function getReferencedValues(formula: string, sheets: Sheet[], sheetIndex: number) {
  const sheet = sheets[sheetIndex]
  if (!sheet) return {}

  return Object.fromEntries(
    parseFormulaReferences(formula).map((reference) => {
      if (reference.includes(':')) return [reference, null]
      try {
        const { row, col } = fromCellNotation(reference)
        return [reference, getCellDisplayValue(getCellFromSheet(sheet, row, col))]
      } catch {
        return [reference, null]
      }
    })
  )
}

export function useFormulaExplainer(gridSheets: Sheet[]) {
  const { activeSheetId } = useWorkbookStore()
  const cacheRef = useRef(new Map<string, FormulaExplanation>())
  const hoverTimerRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [hoveredCell, setHoveredCell] = useState<HoveredFormulaCell | null>(null)
  const [explanation, setExplanation] = useState<FormulaExplanation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  const cancelPending = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
    setIsLoading(false)
  }, [])

  const explainFormula = useCallback(
    async (cell: HoveredFormulaCell) => {
      const cacheKey = hashFormula(cell.formula)
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setExplanation(cached)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)
      setExplanation(null)

      try {
        const response = await fetch('/api/ai/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            formula: cell.formula,
            referencedValues: getReferencedValues(cell.formula, gridSheets, cell.sheetIndex),
          }),
        })

        const data = (await response.json()) as Partial<FormulaExplanation> & { error?: string }
        if (!response.ok) {
          throw new Error(data.error || 'Unable to explain formula.')
        }

        const nextExplanation = {
          explanation: data.explanation ?? 'This formula calculates a result from its inputs.',
          dependencies: data.dependencies ?? parseFormulaReferences(cell.formula),
          sensitivityNote:
            data.sensitivityNote ?? 'Changing referenced cells can change the result.',
        }
        cacheRef.current.set(cacheKey, nextExplanation)
        setExplanation(nextExplanation)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setExplanation({
          explanation: 'Unable to explain this formula right now.',
          dependencies: parseFormulaReferences(cell.formula),
          sensitivityNote: 'Try again after checking the AI configuration.',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [gridSheets]
  )

  const handleCellHover = useCallback(
    (cell: HoveredFormulaCell | null) => {
      if (isPinned) return
      cancelPending()

      if (!cell) {
        setHoveredCell(null)
        setExplanation(null)
        return
      }

      setHoveredCell(cell)
      hoverTimerRef.current = window.setTimeout(() => {
        explainFormula(cell)
      }, 800)
    },
    [cancelPending, explainFormula, isPinned]
  )

  const handleMouseLeave = useCallback(() => {
    if (isPinned) return
    cancelPending()
    setHoveredCell(null)
    setExplanation(null)
  }, [cancelPending, isPinned])

  const togglePin = useCallback(() => {
    setIsPinned((current) => !current)
  }, [])

  useEffect(
    () => () => {
      cancelPending()
    },
    [cancelPending]
  )

  return {
    activeSheetId,
    hoveredCell,
    explanation,
    isLoading,
    isPinned,
    shouldShow: Boolean(hoveredCell && (isLoading || explanation)),
    dependencies: explanation?.dependencies ?? (hoveredCell ? parseFormulaReferences(hoveredCell.formula) : []),
    handleCellHover,
    handleMouseLeave,
    togglePin,
  }
}
