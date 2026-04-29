'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toCellNotation, fromCellNotation } from '@/lib/cellAddress'
import { createCell, getSheetMatrix } from '@/lib/fortuneSheet'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import {
  getCellHistory,
  restoreCell,
  type CellHistoryEntry,
} from '@/features/cell-history/services/historyService'
import type { CellMatrix } from '@fortune-sheet/core'

export function useCellHistory(workbookId: string | null | undefined) {
  const {
    gridSheets,
    selectedCell,
    setFormulaBarValue,
    setGridSheets,
  } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<CellHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const selectedSheet = selectedCell ? gridSheets[selectedCell.sheet] : null
  const sheetId =
    typeof selectedSheet?.id === 'string'
      ? selectedSheet.id
      : activeSheetId
  const cellAddress = useMemo(
    () => (selectedCell ? toCellNotation(selectedCell.row, selectedCell.col) : null),
    [selectedCell]
  )

  const fetchHistory = useCallback(async () => {
    if (!sheetId || !cellAddress) {
      setHistory([])
      return
    }

    setIsLoading(true)
    try {
      const entries = await getCellHistory(workbookId, sheetId, cellAddress)
      setHistory(entries)
    } finally {
      setIsLoading(false)
    }
  }, [cellAddress, sheetId, workbookId])

  useEffect(() => {
    if (!showHistory) return
    void fetchHistory()
  }, [fetchHistory, showHistory])

  const openHistory = useCallback(() => {
    if (!selectedCell) return
    setShowHistory(true)
  }, [selectedCell])

  const closeHistory = useCallback(() => {
    setShowHistory(false)
  }, [])

  const applyRestoredValue = useCallback(
    (result: { sheetId: string; cellAddress: string; restoredValue: string | null }) => {
      const sheetIndex = gridSheets.findIndex((sheet) => sheet.id === result.sheetId)
      const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : selectedCell?.sheet
      if (resolvedSheetIndex === undefined) return

      const sheet = gridSheets[resolvedSheetIndex]
      if (!sheet) return

      const { row, col } = fromCellNotation(result.cellAddress)
      const matrix = getSheetMatrix(sheet).map((sheetRow) => [...(sheetRow ?? [])]) as CellMatrix
      if (!matrix[row]) {
        matrix[row] = []
      }
      matrix[row]![col] = createCell(result.restoredValue)

      const maxColumns = matrix.reduce((max, sheetRow) => Math.max(max, sheetRow?.length ?? 0), 0)
      const nextSheet = {
        ...sheet,
        data: matrix,
        row: Math.max(sheet.row ?? 0, matrix.length, 1),
        column: Math.max(sheet.column ?? 0, maxColumns, 1),
      }
      delete nextSheet.celldata

      const nextSheets = gridSheets.map((gridSheet, index) =>
        index === resolvedSheetIndex ? nextSheet : gridSheet
      )
      setGridSheets(nextSheets)

      if (
        selectedCell &&
        selectedCell.sheet === resolvedSheetIndex &&
        selectedCell.row === row &&
        selectedCell.col === col
      ) {
        setFormulaBarValue(result.restoredValue ?? '')
      }
    },
    [gridSheets, selectedCell, setFormulaBarValue, setGridSheets]
  )

  const handleRestore = useCallback(
    async (historyId: string) => {
      const confirmed = window.confirm('Restore this cell to the selected historical value?')
      if (!confirmed) return

      setIsRestoring(true)
      try {
        const result = await restoreCell(historyId)
        if (!result) return

        applyRestoredValue({
          sheetId: result.historyEntry.sheet_id,
          cellAddress: result.historyEntry.cell_address,
          restoredValue: result.restoredValue,
        })
        await fetchHistory()
      } finally {
        setIsRestoring(false)
      }
    },
    [applyRestoredValue, fetchHistory]
  )

  return {
    cellAddress,
    closeHistory,
    fetchHistory,
    handleRestore,
    history,
    isLoading,
    isRestoring,
    openHistory,
    selectedCell,
    setShowHistory,
    showHistory,
  }
}
