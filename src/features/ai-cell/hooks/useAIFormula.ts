'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AI_FORMULA_TRIGGER } from '@/lib/constants'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { fromCellNotation, toCellNotation } from '@/lib/cellAddress'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'

interface FormulaResponse {
  formula?: string
  explanation?: string
  targetCell?: string
  error?: string
}

function buildSheetContext(): string {
  const { gridSheets } = useSheetStore.getState()
  const { activeSheetId } = useWorkbookStore.getState()
  const activeSheet = gridSheets.find((sheet) => sheet.id === activeSheetId) ?? gridSheets[0]
  if (!activeSheet) return ''

  const rows: string[] = []
  getSheetMatrix(activeSheet)
    .slice(0, 20)
    .forEach((row, rowIndex) => {
      const values = (row ?? [])
        .slice(0, 12)
        .map((cell, colIndex) => {
          const value = getCellDisplayValue(cell)
          return value !== null && value !== '' ? `${toCellNotation(rowIndex, colIndex)}=${value}` : null
        })
        .filter(Boolean)

      if (values.length > 0) {
        rows.push(values.join(', '))
      }
    })

  return rows.join('\n')
}

export function useAIFormula() {
  const { selectedCell, formulaBarValue, setFormulaBarValue, gridInstance } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const openedCellKeyRef = useRef<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formula, setFormula] = useState('')
  const [explanation, setExplanation] = useState('')
  const [targetCell, setTargetCell] = useState<string | null>(null)

  const activeCellAddress = useMemo(
    () => (selectedCell ? toCellNotation(selectedCell.row, selectedCell.col) : 'A1'),
    [selectedCell]
  )
  const cellAddress = targetCell ?? activeCellAddress

  useEffect(() => {
    if (formulaBarValue === AI_FORMULA_TRIGGER) {
      const currentSelectedCell = useSheetStore.getState().selectedCell
      openedCellKeyRef.current = currentSelectedCell
        ? `${currentSelectedCell.sheet}:${currentSelectedCell.row}:${currentSelectedCell.col}`
        : null
      setIsOpen(true)
      setError(null)
      setFormula('')
      setExplanation('')
      setTargetCell(null)
    }
  }, [formulaBarValue])

  useEffect(() => {
    if (!isOpen) return

    const selectedCellKey = selectedCell
      ? `${selectedCell.sheet}:${selectedCell.row}:${selectedCell.col}`
      : null
    if (openedCellKeyRef.current !== null && selectedCellKey !== openedCellKeyRef.current) {
      setIsOpen(false)
      setIsLoading(false)
      setError(null)
      setFormula('')
      setExplanation('')
      setTargetCell(null)
      openedCellKeyRef.current = null
      if (formulaBarValue === AI_FORMULA_TRIGGER) {
        setFormulaBarValue('')
      }
    }
  }, [formulaBarValue, isOpen, selectedCell, setFormulaBarValue])

  const cancel = useCallback(() => {
    setIsOpen(false)
    setIsLoading(false)
    setError(null)
    setFormula('')
    setExplanation('')
    setTargetCell(null)
    openedCellKeyRef.current = null
    if (formulaBarValue === AI_FORMULA_TRIGGER) {
      setFormulaBarValue('')
    }
  }, [formulaBarValue, setFormulaBarValue])

  const generate = useCallback(
    async (instruction: string) => {
      const trimmed = instruction.trim()
      if (!trimmed) {
        setError('Describe the formula you want.')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/ai/formula', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: trimmed,
            cellAddress: activeCellAddress,
            sheetContext: buildSheetContext(),
          }),
        })
        const data = (await response.json()) as FormulaResponse

        if (!response.ok || !data.formula) {
          throw new Error(data.error || 'Unable to generate formula.')
        }

        setFormula(data.formula)
        setExplanation(data.explanation ?? '')
        setTargetCell(data.targetCell ?? null)
        setFormulaBarValue(data.formula)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to generate formula.')
      } finally {
        setIsLoading(false)
      }
    },
    [activeCellAddress, setFormulaBarValue]
  )

  const accept = useCallback(() => {
    if (!formula) return

    setFormulaBarValue(formula)
    const target = targetCell ? fromCellNotation(targetCell) : selectedCell
    if (target && gridInstance) {
      gridInstance.setCellValue(target.row, target.col, formula, {
        id: activeSheetId,
      })
      gridInstance.setSelection([{ row: [target.row, target.row], column: [target.col, target.col] }], {
        id: activeSheetId,
      })
    }
    setIsOpen(false)
  }, [activeSheetId, formula, gridInstance, selectedCell, setFormulaBarValue, targetCell])

  return {
    isOpen,
    isLoading,
    error,
    formula,
    explanation,
    cellAddress,
    selectedCell,
    generate,
    accept,
    cancel,
  }
}
