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
  loadWorkbookExtras,
  saveWorkbookExtras,
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

    // 1. Hydrate from storage (replaces all six stores, clearing leftovers).
    applyWorkbookExtras(loadWorkbookExtras(workbookId))

    // 2. Debounced save on any change to the six stores.
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleSave = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        saveWorkbookExtras(workbookId, collectWorkbookExtras())
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
      if (timer) clearTimeout(timer)
      // Flush so the latest objects aren't stranded in the debounce window.
      saveWorkbookExtras(workbookId, collectWorkbookExtras())
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [workbookId])
}
