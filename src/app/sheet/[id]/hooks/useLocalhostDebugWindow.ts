'use client'

import { useEffect } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import { useFormBuilderStore } from '@/features/forms/store/formBuilderStore'
import { useCleanDataStore } from '@/features/data-cleaning/store/cleanDataStore'
import { useForecastStore } from '@/features/forecasting/store/forecastStore'
import { useCommentsUiStore } from '@/features/comments/store/commentsUiStore'
import { useVersionUiStore } from '@/features/version-history/store/versionUiStore'
import { useShareDialogStore } from '@/features/share-links/store/shareDialogStore'
import { useProtectedRangesUiStore } from '@/features/protected-ranges/store/protectedRangesUiStore'
import { useCFStore } from '@/features/conditional-formatting/store/cfStore'
import { evaluateRules, applyRulesToSheet } from '@/features/conditional-formatting/utils/cfEvaluator'
import * as cellOps from '@/features/ribbon/utils/cellOps'
import { usePrintSettingsStore } from '@/features/page-layout/printSettingsStore'

/**
 * Install the `window.__quiksheetsDebug` test-surface on localhost.
 *
 * Mounts a richer (vs `useDevWindowHelpers`) accessor surface for use
 * from local Chromium / Playwright smoke runs — every feature panel's
 * open/close + the relevant store getters + a few low-level CF + cellOps
 * primitives. Cleared on unmount so panel-state restorations during HMR
 * don't leak across mounts.
 *
 * Gated on `window.location.hostname === 'localhost' || '127.0.0.1'`,
 * so deployed builds are a no-op even before bundler dead-code
 * elimination kicks in.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useLocalhostDebugWindow(): void {
  useEffect(() => {
    const isLocalDebugSession =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (!isLocalDebugSession) return

    const debugWindow = window as Window & {
      __quiksheetsDebug?: {
        getSheetState: typeof useSheetStore.getState
        getWorkbookState: typeof useWorkbookStore.getState
        // feature panel stores — exposed for headless smoke testing
        chartBuilder: { open: () => void; close: () => void }
        pivotBuilder: { open: () => void; close: () => void }
        formBuilder:  { open: () => void; close: () => void }
        cleanData:    { open: () => void; close: () => void }
        forecast:     { open: () => void; close: () => void }
        comments:     { openPanel: () => void; closePanel: () => void; openComposer: (t: { sheetId: string; cellAddress: string }) => void }
        versionHistory: { open: () => void; close: () => void }
        share:        { open: () => void; close: () => void }
        protectedRanges: { open: () => void; close: () => void }
        cf: typeof useCFStore.getState
        cfDebug: {
          evaluateRules: typeof evaluateRules
          applyRulesToSheet: typeof applyRulesToSheet
        }
        cellOps: typeof cellOps
        printSettings: typeof usePrintSettingsStore.getState
      }
    }

    debugWindow.__quiksheetsDebug = {
      getSheetState: useSheetStore.getState,
      getWorkbookState: useWorkbookStore.getState,
      chartBuilder: {
        open:  () => useChartPanelStore.getState().openBuilder(),
        close: () => useChartPanelStore.getState().closeBuilder(),
      },
      pivotBuilder: {
        open:  () => usePivotUiStore.getState().openBuilder(),
        close: () => usePivotUiStore.getState().closeBuilder(),
      },
      formBuilder: {
        open:  () => useFormBuilderStore.getState().open(),
        close: () => useFormBuilderStore.getState().close(),
      },
      cleanData: {
        open:  () => useCleanDataStore.getState().open(),
        close: () => useCleanDataStore.getState().close(),
      },
      forecast: {
        open:  () => useForecastStore.getState().open(),
        close: () => useForecastStore.getState().close(),
      },
      comments: {
        openPanel:    () => useCommentsUiStore.getState().openPanel(),
        closePanel:   () => useCommentsUiStore.getState().closePanel(),
        openComposer: (t) => useCommentsUiStore.getState().openComposer(t),
      },
      versionHistory: {
        open:  () => useVersionUiStore.getState().open(),
        close: () => useVersionUiStore.getState().close(),
      },
      share: {
        open:  () => useShareDialogStore.getState().open(),
        close: () => useShareDialogStore.getState().close(),
      },
      protectedRanges: {
        open:  () => useProtectedRangesUiStore.getState().open(),
        close: () => useProtectedRangesUiStore.getState().close(),
      },
      cf: useCFStore.getState,
      cfDebug: { evaluateRules, applyRulesToSheet },
      cellOps,
      printSettings: usePrintSettingsStore.getState,
    }

    return () => {
      delete debugWindow.__quiksheetsDebug
    }
  }, [])
}
