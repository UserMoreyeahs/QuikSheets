'use client'

/**
 * FillHandle
 * ----------
 * Excel-style fill handle — a small square at the bottom-right corner of
 * the current selection. Dragging it extends the selection and fills values
 * using smart pattern detection (arithmetic, dates, day names, etc.).
 *
 * Positioning: reads FortuneSheet's selection overlay position from the DOM
 * and places itself at its bottom-right corner.
 *
 * PERFORMANCE: no setInterval — only re-positions on selection change,
 * scroll, or resize.  Uses RAF throttle for scroll/resize events.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { detectAndFill } from '../utils/patternDetector'
import { getCellDisplayValue, getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import { toast } from 'sonner'

const HANDLE_SIZE = 8
/** Extra padding around the handle for a larger hover target area. */
const HOVER_PAD = 6

interface FillState {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  /** How many rows/cols to fill beyond the original selection. */
  fillCount: number
  direction: 'down' | 'right' | 'up' | 'left'
}

export function FillHandle() {
  // Only subscribe to the selection — NOT gridSheets (avoids re-render on every cell edit)
  const selectedCell = useSheetStore((s) => s.selectedCell)
  const selectedRange = useSheetStore((s) => s.selectedRange)

  const [handlePos, setHandlePos] = useState<{ left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<{ rows: number; cols: number } | null>(null)
  const fillStateRef = useRef<FillState | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Get the selection bounds
  const selBounds = useCallback(() => {
    if (selectedRange) {
      return {
        r1: Math.min(selectedRange.start.row, selectedRange.end.row),
        r2: Math.max(selectedRange.start.row, selectedRange.end.row),
        c1: Math.min(selectedRange.start.col, selectedRange.end.col),
        c2: Math.max(selectedRange.start.col, selectedRange.end.col),
      }
    }
    if (selectedCell) {
      return { r1: selectedCell.row, r2: selectedCell.row, c1: selectedCell.col, c2: selectedCell.col }
    }
    return null
  }, [selectedRange, selectedCell])

  // Position the handle by finding the FortuneSheet selection overlay in the DOM
  useEffect(() => {
    let rafId = 0

    function updatePosition() {
      const bounds = selBounds()
      if (!bounds) {
        setHandlePos((prev) => (prev === null ? prev : null))
        return
      }

      // Find the fortune-sheet selection element
      const gridContainer = document.querySelector('.fortune-sheet-container')
      if (!gridContainer) {
        setHandlePos((prev) => (prev === null ? prev : null))
        return
      }

      // Find the selection highlight overlay — FortuneSheet renders a blue border div
      let selRect: DOMRect | null = null

      // Try to find the active selection border
      const allBoxes = gridContainer.querySelectorAll('.luckysheet-cell-selected, .fortune-cell-selected')
      for (const box of Array.from(allBoxes)) {
        const r = box.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) { selRect = r; break }
      }

      let newLeft: number
      let newTop: number

      if (!selRect) {
        // Fallback: calculate from cell positions using the grid's internal layout
        const canvasContainer = gridContainer.querySelector('.luckysheet-grid-window, .fortune-sheet-grid')
        if (!canvasContainer) {
          setHandlePos((prev) => (prev === null ? prev : null))
          return
        }
        const containerRect = canvasContainer.getBoundingClientRect()
        const ROW_H = 20
        const COL_W = 73
        const HEADER_W = 46
        const HEADER_H = 20
        const scrollLeft = (canvasContainer as HTMLElement).scrollLeft ?? 0
        const scrollTop = (canvasContainer as HTMLElement).scrollTop ?? 0

        newLeft = containerRect.left + HEADER_W + (bounds.c2 + 1) * COL_W - scrollLeft - HANDLE_SIZE / 2
        newTop = containerRect.top + HEADER_H + (bounds.r2 + 1) * ROW_H - scrollTop - HANDLE_SIZE / 2
      } else {
        newLeft = selRect.right - HANDLE_SIZE / 2
        newTop = selRect.bottom - HANDLE_SIZE / 2
      }

      // Only update state if the position actually changed (avoids re-renders)
      setHandlePos((prev) => {
        if (prev && Math.abs(prev.left - newLeft) < 0.5 && Math.abs(prev.top - newTop) < 0.5) {
          return prev
        }
        return { left: newLeft, top: newTop }
      })
    }

    // Initial position
    updatePosition()
    // Retry once — FortuneSheet may update the DOM asynchronously
    const retryTimer = setTimeout(updatePosition, 80)

    // Throttled handler for scroll/resize
    function throttledUpdate() {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updatePosition)
    }

    window.addEventListener('scroll', throttledUpdate, true)
    window.addEventListener('resize', throttledUpdate)

    return () => {
      clearTimeout(retryTimer)
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [selBounds])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const bounds = selBounds()
    if (!bounds) return

    setDragging(true)
    fillStateRef.current = {
      startRow: bounds.r1,
      startCol: bounds.c1,
      endRow: bounds.r2,
      endCol: bounds.c2,
      fillCount: 0,
      direction: 'down',
    }

    const startY = e.clientY
    const startX = e.clientX

    const onMove = (me: MouseEvent) => {
      const dy = me.clientY - startY
      const dx = me.clientX - startX
      const ROW_H = 20
      const COL_W = 73

      // Determine fill direction based on dominant axis
      if (Math.abs(dy) >= Math.abs(dx)) {
        const rowDelta = Math.round(dy / ROW_H)
        if (rowDelta > 0) {
          setPreview({ rows: rowDelta, cols: 0 })
          if (fillStateRef.current) {
            fillStateRef.current.fillCount = rowDelta
            fillStateRef.current.direction = 'down'
          }
        } else if (rowDelta < 0) {
          setPreview({ rows: rowDelta, cols: 0 })
          if (fillStateRef.current) {
            fillStateRef.current.fillCount = -rowDelta
            fillStateRef.current.direction = 'up'
          }
        } else {
          setPreview(null)
          if (fillStateRef.current) fillStateRef.current.fillCount = 0
        }
      } else {
        const colDelta = Math.round(dx / COL_W)
        if (colDelta > 0) {
          setPreview({ rows: 0, cols: colDelta })
          if (fillStateRef.current) {
            fillStateRef.current.fillCount = colDelta
            fillStateRef.current.direction = 'right'
          }
        } else if (colDelta < 0) {
          setPreview({ rows: 0, cols: colDelta })
          if (fillStateRef.current) {
            fillStateRef.current.fillCount = -colDelta
            fillStateRef.current.direction = 'left'
          }
        } else {
          setPreview(null)
          if (fillStateRef.current) fillStateRef.current.fillCount = 0
        }
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setDragging(false)
      setPreview(null)
      applyFill()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [selBounds])

  function applyFill() {
    const state = fillStateRef.current
    if (!state || state.fillCount === 0) return

    const { gridSheets: sheets, replaceGridSheets } = useSheetStore.getState()
    const sheet = sheets.find((s) => s.status === 1) ?? sheets[0]
    if (!sheet) return

    // Read via the 2D data array (what FortuneSheet actually renders)
    const matrix = getSheetMatrix(sheet)
    // Make a mutable copy of the matrix
    const nextMatrix = matrix.map((row) => [...(row ?? [])])
    const { startRow, startCol, endRow, endCol, fillCount, direction } = state

    try {
      if (direction === 'down' || direction === 'up') {
        for (let c = startCol; c <= endCol; c++) {
          const sourceValues: (string | number | null)[] = []
          for (let r = startRow; r <= endRow; r++) {
            sourceValues.push(getCellDisplayValue(matrix[r]?.[c]) as string | number | null)
          }
          const { values } = detectAndFill(sourceValues, fillCount)

          for (let i = 0; i < fillCount; i++) {
            const targetRow = direction === 'down' ? endRow + 1 + i : startRow - 1 - i
            if (targetRow < 0) continue
            const val = values[i]
            const cellValue = typeof val === 'number' ? val : String(val ?? '')
            // Ensure the row exists in the matrix
            while (nextMatrix.length <= targetRow) {
              nextMatrix.push(Array.from({ length: nextMatrix[0]?.length ?? 1 }, () => null))
            }
            const row = nextMatrix[targetRow]
            if (row) row[c] = { v: cellValue, m: String(cellValue) }
          }
        }
      } else {
        for (let r = startRow; r <= endRow; r++) {
          const sourceValues: (string | number | null)[] = []
          for (let c = startCol; c <= endCol; c++) {
            sourceValues.push(getCellDisplayValue(matrix[r]?.[c]) as string | number | null)
          }
          const { values } = detectAndFill(sourceValues, fillCount)

          for (let i = 0; i < fillCount; i++) {
            const targetCol = direction === 'right' ? endCol + 1 + i : startCol - 1 - i
            if (targetCol < 0) continue
            const val = values[i]
            const cellValue = typeof val === 'number' ? val : String(val ?? '')
            const row = nextMatrix[r]
            if (row) row[targetCol] = { v: cellValue, m: String(cellValue) }
          }
        }
      }

      // Write back via cloneSheetWithData — this writes to `data` (the 2D
      // array FortuneSheet actually renders) and clears stale `celldata`.
      const updatedSheets = sheets.map((s) =>
        s === sheet ? cloneSheetWithData(s, nextMatrix) : s
      )
      replaceGridSheets(updatedSheets)
      const dirLabel = direction === 'down' || direction === 'up' ? `${fillCount} rows` : `${fillCount} columns`
      toast.success(`Filled ${dirLabel} ${direction}.`)
    } catch {
      toast.error('Could not fill cells.')
    }
    fillStateRef.current = null
  }

  if (!handlePos || !selBounds()) return null

  return (
    <>
      {/* Invisible hover zone — shows the blue handle on hover / while dragging */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        className="group fixed z-[55] cursor-crosshair"
        style={{
          left: handlePos.left - HOVER_PAD,
          top: handlePos.top - HOVER_PAD,
          width: HANDLE_SIZE + HOVER_PAD * 2,
          height: HANDLE_SIZE + HOVER_PAD * 2,
        }}
        title="Drag to fill"
      >
        {/* Visible blue square — hidden by default, shown on hover or drag */}
        <div
          className={[
            'absolute rounded-[1px] transition-opacity duration-100',
            dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
          style={{
            left: HOVER_PAD,
            top: HOVER_PAD,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            backgroundColor: '#2563eb',
            border: '1px solid white',
          }}
        />
      </div>
      {/* Drag preview indicator */}
      {dragging && preview && (
        <div
          className="fixed z-[54] pointer-events-none rounded border border-blue-400 bg-blue-100/30 dark:bg-blue-900/20"
          style={{
            left: handlePos.left - 20,
            top: handlePos.top + HANDLE_SIZE + 4,
          }}
        >
          <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
            {preview.rows !== 0
              ? `${Math.abs(preview.rows)} row${Math.abs(preview.rows) > 1 ? 's' : ''} ${preview.rows > 0 ? '↓' : '↑'}`
              : `${Math.abs(preview.cols)} col${Math.abs(preview.cols) > 1 ? 's' : ''} ${preview.cols > 0 ? '→' : '←'}`
            }
          </span>
        </div>
      )}
    </>
  )
}
