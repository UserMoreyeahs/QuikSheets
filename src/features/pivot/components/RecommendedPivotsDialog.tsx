'use client'

/**
 * RecommendedPivotsDialog — Excel's Insert > Recommended PivotTables.
 *
 * Analyses the user's selection (or auto-detected data block) and shows
 * 2-4 sensible pivot suggestions as cards with mini preview tables. One
 * click on "Insert" feeds the chosen config through the same pivot store
 * the manual PivotBuilder uses.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { TableIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useRecommendedPivotsStore } from '../store/recommendedPivotsStore'
import { usePivotUiStore } from '../store/pivotUiStore'
import { useSheetStore } from '@/store/sheetStore'
import { getRangeMatrix, detectContiguousDataBlock, boundsToA1, parseA1Range } from '@/features/charts/utils/rangeUtils'
import { pivot } from '../pivotAggregator'
import { recommendPivots, type PivotRecommendation } from '../utils/recommendPivots'

export function RecommendedPivotsDialog() {
  const open = useRecommendedPivotsStore((s) => s.open)
  const closePicker = useRecommendedPivotsStore((s) => s.closePicker)
  const addPivot = usePivotUiStore((s) => s.addPivot)
  const { gridSheets, selectedCell, selectedRange } = useSheetStore()
  const [rangeText, setRangeText] = useState('')

  const activeSheet = useMemo(
    () => gridSheets.find((s) => s.status === 1) ?? gridSheets[0],
    [gridSheets],
  )

  // Default the range when opening: explicit user selection if multi-cell,
  // otherwise auto-detect the contiguous block around the active cell.
  useEffect(() => {
    if (!open || !activeSheet) return
    let r = ''
    if (selectedRange) {
      const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
      const er = Math.max(selectedRange.start.row, selectedRange.end.row)
      const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
      const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
      const isSingleCell = sr === er && sc === ec
      if (!isSingleCell) {
        r = boundsToA1({ rowStart: sr, rowEnd: er, colStart: sc, colEnd: ec })
      }
    }
    if (!r) {
      const seed = selectedCell ?? { row: 0, col: 0 }
      const block = detectContiguousDataBlock(activeSheet, seed.row, seed.col)
      if (block) r = boundsToA1(block)
    }
    setRangeText(r || 'A1:D10')
  }, [open, activeSheet, selectedCell, selectedRange])

  const matrix = useMemo(() => {
    if (!activeSheet || !rangeText) return []
    return getRangeMatrix(activeSheet, rangeText)
  }, [activeSheet, rangeText])

  const headers = useMemo<string[]>(() => {
    const cols = matrix[0]?.length ?? 0
    return (matrix[0] ?? []).map((v, i) => (v == null || v === '' ? `Column ${i + 1}` : String(v))).concat(
      Array.from({ length: Math.max(0, cols - (matrix[0]?.length ?? 0)) }, (_, i) => `Column ${i + 1}`),
    )
  }, [matrix])

  const dataRows = useMemo(() => matrix.slice(1), [matrix])

  const recommendations = useMemo<PivotRecommendation[]>(() => {
    if (dataRows.length === 0 || headers.length === 0) return []
    return recommendPivots(dataRows, headers)
  }, [dataRows, headers])

  function applyRecommendation(rec: PivotRecommendation): void {
    const bounds = parseA1Range(rangeText)
    if (!bounds || !activeSheet) {
      toast.error('Invalid range.')
      return
    }
    try {
      const result = pivot(dataRows, rec.config)
      addPivot({
        name: rec.title,
        sourceRange: rangeText.trim().toUpperCase(),
        hasHeader: true,
        config: rec.config,
        result,
        headerLabels: headers,
        anchorRow: 0,
        anchorCol: (bounds.colEnd ?? 0) + 1,
        offsetX: 120,
        offsetY: 120,
      })
      toast.success(`Inserted: ${rec.title}`)
      closePicker()
    } catch (e) {
      toast.error(`Could not insert: ${String(e)}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closePicker() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-4 w-4 text-violet-500" />
            Recommended PivotTables
          </DialogTitle>
          <DialogDescription>
            Quiksheets analysed your data and prepared these pivot layouts.
            Pick one to insert it as a floating panel, then drag fields in
            the builder to refine further.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[12px] dark:border-zinc-700 dark:bg-zinc-800/40">
          <span className="font-mono text-zinc-500">Source</span>
          <input
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            className="h-7 flex-1 rounded border border-zinc-300 px-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-zinc-400">({dataRows.length} data row{dataRows.length === 1 ? '' : 's'}, {headers.length} cols)</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-[12px] text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            Couldn&apos;t find a useful pivot for this range. Try a range with at
            least one text column and one numeric column.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                matrix={dataRows}
                headers={headers}
                onApply={() => applyRecommendation(rec)}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closePicker}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface RecommendationCardProps {
  rec: PivotRecommendation
  matrix: (string | number | null)[][]
  headers: string[]
  onApply: () => void
}

function RecommendationCard({ rec, matrix, headers, onApply }: RecommendationCardProps) {
  const preview = useMemo(() => {
    try {
      return pivot(matrix, rec.config)
    } catch {
      return null
    }
  }, [matrix, rec.config])

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <h4 className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">{rec.title}</h4>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{rec.description}</p>
      </div>

      {preview && preview.rows.length > 0 && (
        <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-[10px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/40">
              <tr>
                {rec.config.rows.map((c) => (
                  <th key={`r-${c}`} className="border-b border-zinc-200 px-1.5 py-1 text-left font-medium text-zinc-500 dark:border-zinc-700">
                    {headers[c] ?? `Col ${c + 1}`}
                  </th>
                ))}
                {preview.valueLabels.map((label, i) => (
                  <th key={`v-${i}`} className="border-b border-zinc-200 px-1.5 py-1 text-right font-medium text-zinc-500 dark:border-zinc-700">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 5).map((row, r) => (
                <tr key={r}>
                  {row.keys.map((k, i) => (
                    <td key={`k-${i}`} className="border-b border-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                      {k}
                    </td>
                  ))}
                  {row.valuesByCol.flat().map((v, i) => (
                    <td key={`v-${i}`} className="border-b border-zinc-100 px-1.5 py-0.5 text-right font-mono text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                      {Number.isFinite(v) ? v.toLocaleString() : ''}
                    </td>
                  ))}
                </tr>
              ))}
              {preview.rows.length > 5 && (
                <tr>
                  <td colSpan={rec.config.rows.length + preview.valueLabels.length} className="px-1.5 py-0.5 text-center italic text-zinc-400">
                    … {preview.rows.length - 5} more row{preview.rows.length - 5 === 1 ? '' : 's'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={onApply}
        className="mt-auto rounded bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-700"
      >
        Insert this pivot
      </button>
    </div>
  )
}
