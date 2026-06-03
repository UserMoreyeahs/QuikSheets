'use client'

import { useEffect } from 'react'
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import { useSparklineStore } from '@/features/sparklines/store/sparklineStore'
import { useSlicerStore } from '@/features/slicers/store/slicerStore'
import { useImageStore } from '@/features/images/store/imageStore'
import { useOverlayStore } from '@/features/overlays/store/overlayStore'
import {
  applyWorkbookExtras,
  collectWorkbookExtras,
  hasAnyExtras,
  loadWorkbookExtrasResolved,
  saveWorkbookExtrasResolved,
} from '@/lib/workbookExtras'

/**
 * Persist + restore the workbook's visualization objects (charts, pivots,
 * sparklines, slicers, images, overlays) across reloads. These live in
 * global Zustand singletons that the cell-save path never touched, so they
 * were lost on every reopen.
 *
 * On mount: load this workbook's saved extras and hydrate all six stores
 * (always replacing — so the previous workbook's objects don't leak in).
 * Then subscribe to all six stores and debounce-save on any change, plus a
 * final flush on unmount.
 */
export function useWorkbookExtrasPersistence(workbookId: string): void {
  useEffect(() => {
    if (!workbookId) return
    let cancelled = false

    // 1. Clear any leftovers from a previously-open workbook immediately,
    //    then hydrate from storage (Supabase-first for cloud workbooks,
    //    localStorage fallback). The async load won't clobber objects the
    //    user added during the round-trip (hasAnyExtras guard).
    applyWorkbookExtras(null)
    void loadWorkbookExtrasResolved(workbookId).then((extras) => {
      if (cancelled || !extras) return
      if (hasAnyExtras(collectWorkbookExtras())) return
      applyWorkbookExtras(extras)
    })

    // 2. Debounced save on any change to the six stores (cloud + local).
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleSave = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void saveWorkbookExtrasResolved(workbookId, collectWorkbookExtras())
      }, 1_200)
    }

    const unsubscribers = [
      useChartPanelStore.subscribe(scheduleSave),
      usePivotUiStore.subscribe(scheduleSave),
      useSparklineStore.subscribe(scheduleSave),
      useSlicerStore.subscribe(scheduleSave),
      useImageStore.subscribe(scheduleSave),
      useOverlayStore.subscribe(scheduleSave),
    ]

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      // Flush so the latest objects aren't stranded in the debounce window.
      void saveWorkbookExtrasResolved(workbookId, collectWorkbookExtras())
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [workbookId])
}
