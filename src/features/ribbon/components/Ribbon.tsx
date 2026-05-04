'use client'

/**
 * Ribbon shell
 * Renders AppMenuBar (text menus) + QuickToolbar (icon row).
 * All handlers are passed in from the sheet page so state lives in one place.
 */

import { AppMenuBar } from './AppMenuBar'
import { QuickToolbar } from './QuickToolbar'

export interface RibbonHandlers {
  // ── File backstage ──────────────────────────────────
  onNewWorkbook?: () => void
  onOpenDashboard?: () => void
  onSaveNow?: () => void
  onImport?: () => void
  onExportCSV?: () => void
  onExportXLSX?: () => void
  onExportPDF?: () => void
  // ── Editing ─────────────────────────────────────────
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onFind: () => void
  onConditionalFormatting: () => void
  onMergeCells: () => void
  onUnmergeCells: () => void
  onClearFormatting: () => void
  onValidation: () => void
  onAutoSum?: () => void
  onInsertRow?: () => void
  onDeleteRow?: () => void
  // ── Insert / AI ─────────────────────────────────────
  onInsertSheet: () => void
  onAIAssistant: () => void
  onRowSummarizer?: () => void
  onColumnDNA?: () => void
  onInsertChart?: () => void
  onInsertForm?: () => void
  onInsertPivot?: () => void
  onCleanData?: () => void
  onForecast?: () => void
  // ── Data ────────────────────────────────────────────
  onMapView: () => void
  onDedupe?: () => void
  // ── Review / Collab / Sharing ───────────────────────
  onComments?: () => void
  onShareLink?: () => void
  onProtectedRanges?: () => void
  onVersionHistory?: () => void
  // ── Review / Help ───────────────────────────────────
  onShortcuts: () => void
  // ── View toggles ────────────────────────────────────
  formulaBarVisible?: boolean
  gridlinesVisible?: boolean
  onToggleFormulaBar?: () => void
  onToggleGridlines?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
}

export function Ribbon({ handlers }: { handlers: RibbonHandlers }) {
  return (
    <div className="shrink-0">
      <AppMenuBar handlers={handlers} />
      <QuickToolbar handlers={handlers} />
    </div>
  )
}
