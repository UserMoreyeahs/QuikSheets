'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cloneSheetWithData, getCellDisplayValue, getSheetMatrix } from '@/lib/fortuneSheet'
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from '@/lib/constants'
import { detectColumnIntent } from '@/features/intent-columns/utils/columnIntent'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { Cell, Sheet } from '@fortune-sheet/core'
import type { ActiveFormatting, NumberFormat } from '@/types/sheet.types'
import type { ColumnIntent } from '@/features/intent-columns/utils/columnIntent'

interface PendingColumnIntent {
  header: string
  col: number
  sheetIndex: number
  intent: ColumnIntent
  position: { left: number; top: number }
}

const ROW_HEADER_WIDTH = 46
const COLUMN_HEADER_HEIGHT = 20

function getFormatString(format: NumberFormat): string {
  switch (format) {
    case 'currency':
      return '$0.00'
    case 'percentage':
      return '0.00%'
    case 'date_short':
      return 'MM/DD/YYYY'
    case 'date_long':
      return 'MMMM D, YYYY'
    case 'number':
      return '0.00'
    case 'text':
      return '@'
    default:
      return 'General'
  }
}

function intentToFormatting(intent: ColumnIntent): Partial<ActiveFormatting> {
  return {
    numberFormat: intent.format,
    ...(intent.type === 'email' || intent.type === 'url'
      ? { textColor: '#2563eb', underline: true }
      : {}),
  }
}

function intentToCellStyle(intent: ColumnIntent): Partial<Cell> {
  return {
    ct: {
      fa: getFormatString(intent.format),
      t: intent.format === 'text' ? 's' : 'n',
    },
    ...(intent.type === 'email' || intent.type === 'url'
      ? { fc: '#2563eb', un: 1 as const }
      : {}),
  }
}

function getHeaderValues(sheets: Sheet[], sheetIndex: number): string[] {
  const sheet = sheets[sheetIndex]
  if (!sheet) return []

  const firstRow = getSheetMatrix(sheet)[0] ?? []
  return firstRow.map((cell) => {
    const value = getCellDisplayValue(cell)
    return value === null || value === undefined ? '' : String(value)
  })
}

function applyIntentToColumn(
  sheets: Sheet[],
  pending: PendingColumnIntent,
  activeSheetId: string
): Sheet[] {
  const sheetIndex = sheets.findIndex((sheet) => sheet.id === activeSheetId)
  const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : pending.sheetIndex
  const activeSheet = sheets[resolvedSheetIndex]
  if (!activeSheet) return sheets

  const data = getSheetMatrix(activeSheet)
  const nextData = data.map((row) => [...(row ?? [])])
  const style = intentToCellStyle(pending.intent)
  const rowCount = Math.max(nextData.length, activeSheet.row ?? 100)

  for (let row = 1; row < rowCount; row += 1) {
    if (!nextData[row]) nextData[row] = []
    const existing = (nextData[row]![pending.col] ?? null) as Cell | null
    nextData[row]![pending.col] = { ...(existing ?? {}), ...style }
  }

  return sheets.map((sheet, index) =>
    index === resolvedSheetIndex ? cloneSheetWithData(sheet, nextData) : sheet
  )
}

export function useColumnIntent(gridSheets: Sheet[]) {
  const { activeSheetId } = useWorkbookStore()
  const previousHeadersRef = useRef<string[]>([])
  const initializedRef = useRef(false)
  const [pendingIntent, setPendingIntent] = useState<PendingColumnIntent | null>(null)

  useEffect(() => {
    const sheetIndex = gridSheets.findIndex((sheet) => sheet.id === activeSheetId)
    const resolvedSheetIndex = sheetIndex >= 0 ? sheetIndex : 0
    const headers = getHeaderValues(gridSheets, resolvedSheetIndex)

    if (!initializedRef.current) {
      previousHeadersRef.current = headers
      initializedRef.current = true
      return
    }

    headers.forEach((header, col) => {
      if (!header.trim() || header === previousHeadersRef.current[col]) return

      const intent = detectColumnIntent(header)
      if (!intent) return

      setPendingIntent({
        header,
        col,
        sheetIndex: resolvedSheetIndex,
        intent,
        position: {
          left: ROW_HEADER_WIDTH + col * DEFAULT_CELL_WIDTH,
          top: COLUMN_HEADER_HEIGHT + DEFAULT_CELL_HEIGHT + 6,
        },
      })
    })

    previousHeadersRef.current = headers
  }, [activeSheetId, gridSheets])

  const dismiss = useCallback(() => {
    setPendingIntent(null)
  }, [])

  const confirm = useCallback(() => {
    if (!pendingIntent) return

    const sheetState = useSheetStore.getState()
    sheetState.setActiveFormatting(intentToFormatting(pendingIntent.intent))
    sheetState.setGridSheets(
      applyIntentToColumn(sheetState.gridSheets, pendingIntent, activeSheetId)
    )

    if (pendingIntent.intent.validation) {
      for (let row = 1; row < 100; row += 1) {
        sheetState.setValidationRule(
          `${activeSheetId}:${row}:${pendingIntent.col}`,
          pendingIntent.intent.validation
        )
      }
    }

    setPendingIntent(null)
  }, [activeSheetId, pendingIntent])

  const change = useCallback(() => {
    if (!pendingIntent) return

    const next = window.prompt('Set this column type:', pendingIntent.intent.suggestion)
    if (!next) {
      setPendingIntent(null)
      return
    }

    const intent = detectColumnIntent(next)
    if (!intent) {
      setPendingIntent(null)
      return
    }

    setPendingIntent({ ...pendingIntent, intent })
  }, [pendingIntent])

  return {
    pendingIntent,
    confirm,
    change,
    dismiss,
  }
}
