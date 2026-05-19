/**
 * Typed Columns — public surface.
 *
 * Consumers (mainly src/app/sheet/[id]/page.tsx and the Insert tab):
 *   - `useColumnTypesStore`                  — Zustand store
 *   - `useTypedColumnsEnforcement(workbookId)` — hydrate + reformat hook
 *   - `ColumnTypePicker`                     — UI picker for column header
 *   - `validateForEdit` / `formatForDisplay` — pure utilities
 *   - `STATUS_PRESETS`                       — chip colors for Status type
 */

export { useColumnTypesStore } from './store/columnTypesStore'
export { useTypedColumnsEnforcement } from './hooks/useTypedColumnsEnforcement'
export { ColumnTypePicker } from './components/ColumnTypePicker'
export { ColumnTypeRibbonButton } from './components/ColumnTypeRibbonButton'
export {
  formatForDisplay,
  validateForEdit,
  type ValidateResult,
} from './utils/columnTypeFormatters'
export {
  type ColumnType,
  type ColumnTypeMeta,
  COLUMN_TYPE_ICONS,
  COLUMN_TYPE_LABELS,
  STATUS_PRESETS,
} from './types'
