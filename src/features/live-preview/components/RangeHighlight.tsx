'use client'

import React from 'react'
import { fromCellNotation } from '@/lib/cellAddress'
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from '@/lib/constants'

const COLORS = [
  'bg-blue-200/50 border-blue-300',
  'bg-green-200/50 border-green-300',
  'bg-orange-200/50 border-orange-300',
  'bg-purple-200/50 border-purple-300',
]

interface RangeHighlightProps {
  references: string[]
  rowHeaderWidth: number
  columnHeaderHeight: number
}

function getRangePosition(reference: string, rowHeaderWidth: number, columnHeaderHeight: number) {
  const [start, end] = reference.split(':')
  if (!start) return null

  const startCell = fromCellNotation(start)
  const endCell = end ? fromCellNotation(end) : startCell
  const startRow = Math.min(startCell.row, endCell.row)
  const endRow = Math.max(startCell.row, endCell.row)
  const startCol = Math.min(startCell.col, endCell.col)
  const endCol = Math.max(startCell.col, endCell.col)

  return {
    left: rowHeaderWidth + startCol * DEFAULT_CELL_WIDTH,
    top: columnHeaderHeight + startRow * DEFAULT_CELL_HEIGHT,
    width: (endCol - startCol + 1) * DEFAULT_CELL_WIDTH,
    height: (endRow - startRow + 1) * DEFAULT_CELL_HEIGHT,
  }
}

export function RangeHighlight({
  references,
  rowHeaderWidth,
  columnHeaderHeight,
}: RangeHighlightProps) {
  return (
    <>
      {references.map((reference, index) => {
        try {
          const position = getRangePosition(reference, rowHeaderWidth, columnHeaderHeight)
          if (!position) return null

          return (
            <div
              key={`${reference}-${index}`}
              style={position}
              className={`pointer-events-none absolute z-[45] rounded-sm border transition-all duration-150 ${
                COLORS[index % COLORS.length]
              }`}
            />
          )
        } catch {
          return null
        }
      })}
    </>
  )
}
