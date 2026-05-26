/**
 * Theme shape used by Page Layout > Themes / Colors / Fonts.
 *
 * A theme bundles a 6-colour palette + a font pair. The active theme
 * influences:
 *   - applyTablePalette()         in cellOps.ts (Format as Table)
 *   - the "Theme Colors" row in the toolbar colour picker
 *   - the default chart series colour
 *
 * Theme presets live in `presets.ts` and are referenced by id.
 */

export interface ThemeColors {
  /** Primary accent — used as Format-as-Table header background. */
  primary: string
  /** Lighter accent — used as Format-as-Table alternating row fill. */
  accent: string
  success: string
  warning: string
  danger: string
  /** Neutral surface — used as the un-tinted row in alternating tables. */
  surface: string
}

export interface Theme {
  id: string
  name: string
  description: string
  colors: ThemeColors
  /** Display font used in headers (Format as Table, chart titles). */
  headingFont: string
  /** Body font used in cell values when the user picks "Theme default". */
  bodyFont: string
}
