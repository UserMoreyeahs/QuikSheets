/**
 * Dashboards feature — public API barrel.
 *
 * Orchestrator wires:
 *   1. Load: call `useDashboardStore.getState().load(workbookId)` on mount
 *      (same pattern as applyAllCFRules in cfStore).
 *   2. Builder: render <DashboardBuilder /> anywhere in the sheet layout
 *      (it's a portal-style fixed overlay — position doesn't matter).
 *   3. List panel: render <DashboardsList /> in a slide-in panel or modal.
 *   4. Ribbon/menu button: call `useDashboardStore.getState().openBuilder()`
 *      or toggle the DashboardsList panel open.
 *
 * Migration to apply before first use:
 *   docs/setup/migrations/dashboards_table.sql
 */

// Types
export type {
  Dashboard,
  Widget,
  KpiWidget,
  ChartWidget,
  TextWidget,
  TableWidget,
  WidgetLayout,
} from './types'
export {
  makeDefaultLayout,
  computeAggregate,
  computeDeltaPercent,
  formatKpiValue,
} from './types'

// Store
export {
  useDashboardStore,
  selectActiveDashboard,
  selectDashboardById,
  makeKpiWidget,
  makeChartWidget,
  makeTextWidget,
  makeTableWidget,
} from './store/dashboardStore'

// Components
export { DashboardBuilder } from './components/DashboardBuilder'
export { DashboardCanvas } from './components/DashboardCanvas'
export { DashboardsList } from './components/DashboardsList'
export { WidgetEditDialog } from './components/WidgetEditDialog'

// Utils
export { extractNumericValues, extractRangeMatrix } from './utils/rangeValues'
