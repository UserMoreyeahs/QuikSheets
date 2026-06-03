'use client'

/**
 * AdvancedFilterPill — banner shown above the grid when an Excel-style
 * Advanced Filter is active on the current sheet. Mirrors the style of
 * the existing filter indicator in StatusBar.tsx but lives above the
 * grid so it doesn't get lost in the footer bar.
 */

import { WandSparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkbookStore } from '@/store/workbookStore'
import { useSheetStore } from '@/store/sheetStore'
import { useAdvancedFilterStore } from '../store/advancedFilterStore'

export function AdvancedFilterPill() {
  const activeSheetId = useWorkbookStore((s) => s.activeSheetId)
  const criteria = useAdvancedFilterStore((s) => s.criteriaBySheet[activeSheetId])
  const openDialog = useAdvancedFilterStore((s) => s.openDialog)
  const applyAdvancedFilter = useSheetStore((s) => s.applyAdvancedFilterToActiveSheet)

  if (!criteria) return null

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
      <WandSparkles className="h-3.5 w-3.5" />
      <span className="font-semibold">Advanced filter active</span>
      <span className="hidden sm:inline text-blue-700/80 dark:text-blue-300/80">
        — list <code className="rounded bg-blue-100 px-1 font-mono text-[10px] dark:bg-blue-900/40">{criteria.listRange}</code>,
        criteria <code className="rounded bg-blue-100 px-1 font-mono text-[10px] dark:bg-blue-900/40">{criteria.criteriaRange}</code>
      </span>
      <button
        type="button"
        onClick={openDialog}
        className="ml-auto rounded border border-blue-300 px-2 py-0.5 text-[10px] font-medium hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900/50"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          applyAdvancedFilter(null)
          toast.success('Advanced filter cleared')
        }}
        className="flex items-center gap-1 rounded border border-blue-300 px-2 py-0.5 text-[10px] font-medium hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900/50"
      >
        <X className="h-3 w-3" />
        Clear
      </button>
    </div>
  )
}
