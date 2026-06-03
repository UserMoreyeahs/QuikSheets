'use client'

/**
 * themeStore — active theme + picker-dialog open state.
 *
 * Mirrors the pattern used by useShapePickerStore / useIconPickerStore:
 * one tiny store covers both the persistent state (active theme id) and
 * the transient UI state (dialog open). Theme switches are write-once /
 * read-many: the table-palette and color-picker integrations read
 * `getActiveTheme()` at the moment of formatting, so a theme change
 * affects subsequent inserts but doesn't rewrite the workbook.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { DEFAULT_THEME_ID, getThemeById, THEME_PRESETS } from '../presets'
import type { Theme } from '../types'

interface ThemeState {
  /** Id of the currently applied theme. */
  activeThemeId: string
  /** Whether the Themes picker dialog is visible. */
  pickerOpen: boolean
}

interface ThemeActions {
  setActiveTheme: (id: string) => void
  openPicker:  () => void
  closePicker: () => void
}

export const useThemeStore = create<ThemeState & ThemeActions>()(
  devtools(
    (set) => ({
      activeThemeId: DEFAULT_THEME_ID,
      pickerOpen: false,
      setActiveTheme: (id) => set({ activeThemeId: id }, false, 'theme/setActive'),
      openPicker:  () => set({ pickerOpen: true },  false, 'theme/openPicker'),
      closePicker: () => set({ pickerOpen: false }, false, 'theme/closePicker'),
    }),
    { name: 'ThemeStore' },
  ),
)

/**
 * Imperative accessor — call this from non-React code (cell ops, PDF
 * exporter) to read the active theme without subscribing.
 */
export function getActiveTheme(): Theme {
  return getThemeById(useThemeStore.getState().activeThemeId)
}

export { THEME_PRESETS }
