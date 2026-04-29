'use client'

import { useEffect, useMemo, useState } from 'react'
import { getHyperFormulaInstance } from '@/lib/hyperformula'
import { getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { extractCellReferences } from '@/features/formula-engine'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'

export interface LivePreviewResult {
  previewValue: string | number | boolean | null
  references: string[]
  isValid: boolean
}

function formatPreviewValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'object' && 'type' in value) return null
  return String(value)
}

function getPrimitiveCellValue(cell: unknown): string | number | boolean | null {
  const value = getCellDisplayValue(cell as never)
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return null
}

export function useLivePreview(): LivePreviewResult {
  const { formulaBarValue, editingCell, gridSheets } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const [result, setResult] = useState<LivePreviewResult>({
    previewValue: null,
    references: [],
    isValid: false,
  })

  const activeSheetIndex = useMemo(() => {
    const index = gridSheets.findIndex((sheet) => sheet.id === activeSheetId)
    return index >= 0 ? index : 0
  }, [activeSheetId, gridSheets])

  useEffect(() => {
    if (!editingCell || !formulaBarValue.startsWith('=')) {
      setResult({ previewValue: null, references: [], isValid: false })
      return
    }

    const timer = window.setTimeout(() => {
      try {
        const activeSheet = gridSheets[activeSheetIndex]
        if (!activeSheet) {
          setResult({ previewValue: null, references: [], isValid: false })
          return
        }

        const hf = getHyperFormulaInstance()
        const sheetName = `__preview_${Date.now()}_${Math.random().toString(36).slice(2)}`
        hf.addSheet(sheetName)
        const sheetId = hf.getSheetId(sheetName)
        if (sheetId === undefined) {
          setResult({ previewValue: null, references: [], isValid: false })
          return
        }

        const matrix = getSheetMatrix(activeSheet)
        matrix.forEach((row, rowIndex) => {
          ;(row ?? []).forEach((cell, colIndex) => {
            const value = getPrimitiveCellValue(cell)
            if (value !== null && !(rowIndex === editingCell.row && colIndex === editingCell.col)) {
              hf.setCellContents({ sheet: sheetId, row: rowIndex, col: colIndex }, [[value]])
            }
          })
        })

        hf.setCellContents(
          { sheet: sheetId, row: editingCell.row, col: editingCell.col },
          [[formulaBarValue]]
        )

        const previewValue = formatPreviewValue(
          hf.getCellValue({ sheet: sheetId, row: editingCell.row, col: editingCell.col })
        )
        hf.removeSheet(sheetId)

        setResult({
          previewValue,
          references: extractCellReferences(formulaBarValue),
          isValid: previewValue !== null,
        })
      } catch {
        setResult({ previewValue: null, references: [], isValid: false })
      }
    }, 150)

    return () => window.clearTimeout(timer)
  }, [activeSheetIndex, editingCell, formulaBarValue, gridSheets])

  return result
}
