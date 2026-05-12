/**
 * Conditional Formatting Type Definitions
 *
 * These types model the full Excel-style CF rule system used in Quiksheets.
 * A `CFRule` is stored in cfStore (keyed by workbookId + sheetId) and
 * evaluated by cfEvaluator.ts at render time.
 *
 * Rule hierarchy (mirroring Excel):
 *   CFRule
 *   ├── id          — UUID for React key / delete by ID
 *   ├── range       — A1-notation range, e.g. "A1:D100"
 *   ├── priority    — Lower = higher priority (first match wins)
 *   ├── kind        — "standard" | "data_bar" | "color_scale" | "icon_set"
 *   ├── condition   — What triggers the rule (cell value, text, date, stats…)
 *   ├── format      — What style to apply when the condition is met
 *   └── [dataBar|colorScale|iconSet] — Config for visual rules
 */

/** Condition types that can trigger a CF rule. */
export type CFConditionType =
  | 'cell_value'        // Greater than, equal to, between, etc.
  | 'text_contains'     // Contains, starts with, ends with, not contains
  | 'cell_empty'        // Blank cells
  | 'cell_not_empty'    // Non-blank cells
  | 'duplicate_values'  // Cells that appear more than once in the range
  | 'unique_values'     // Cells that appear exactly once
  | 'top_n'             // Top N values in the range
  | 'bottom_n'          // Bottom N values in the range
  | 'top_n_percent'     // Top N% of values
  | 'bottom_n_percent'  // Bottom N% of values
  | 'above_average'     // Above the range mean
  | 'below_average'     // Below the range mean
  | 'date_occurring'    // Date falls within a relative period (today, last week, …)
  | 'custom_formula'    // Custom formula that evaluates to TRUE

/** Comparison operators for `cell_value` and `text_contains` conditions. */
export type CFOperator =
  | 'equal'
  | 'not_equal'
  | 'greater'
  | 'greater_equal'
  | 'less'
  | 'less_equal'
  | 'between'
  | 'not_between'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'

/** Relative date periods for `date_occurring` conditions. */
export type CFDatePeriod =
  | 'yesterday'
  | 'today'
  | 'tomorrow'
  | 'last7Days'
  | 'lastWeek'
  | 'thisWeek'
  | 'nextWeek'
  | 'lastMonth'
  | 'thisMonth'
  | 'nextMonth'

/**
 * Discriminates between standard (highlight) rules and visual indicator rules.
 *
 * - `standard`    — Fill / text colour / bold / italic
 * - `data_bar`    — Horizontal bar proportional to cell value
 * - `color_scale` — Gradient fill from minColor to maxColor
 * - `icon_set`    — Emoji/icon prepended to cell display value
 */
export type CFRuleKind = 'standard' | 'data_bar' | 'color_scale' | 'icon_set'

/** What triggers a CF rule to match a cell. */
export interface CFCondition {
  type: CFConditionType
  /** Comparison operator (used by `cell_value` and `text_contains`). */
  operator?: CFOperator
  /** Primary comparison value (string form; converted to number when needed). */
  value?: string
  /** Upper bound for `between` / `not_between` operators. */
  value2?: string
  /** N for top_n / bottom_n / top_n_percent / bottom_n_percent conditions. */
  n?: number
  /** Which period to check for `date_occurring` conditions. */
  datePeriod?: CFDatePeriod
}

/** The style applied to matching cells. All fields are optional. */
export interface CFFormat {
  /** Background fill colour (hex string, e.g. "#FFEB9C"). */
  fill?: string
  /** Text colour (hex string). */
  color?: string
  bold?: boolean
  italic?: boolean
}

/** Configuration for a Data Bar visual rule. */
export interface CFDataBarConfig {
  /** Bar fill colour. */
  color: string
  /** Whether to use a gradient fill (lighter at the start). */
  gradient: boolean
}

/** Configuration for a Color Scale visual rule (2- or 3-colour scale). */
export interface CFColorScaleConfig {
  /** Colour for the minimum value. */
  minColor: string
  /** Optional midpoint colour (3-colour scale). */
  midColor?: string
  /** Colour for the maximum value. */
  maxColor: string
}

/** Configuration for an Icon Set visual rule. */
export interface CFIconSetConfig {
  /** Display name of the icon set (e.g. "3 Arrows"). */
  name: string
  /** Ordered emoji/text icons (highest → lowest tier). */
  icons: string[]
}

/**
 * A single Conditional Formatting rule.
 *
 * Stored in cfStore and persisted to localStorage at
 * `quiksheets_cf_rules:<workbookId>`, keyed by sheetId.
 */
export interface CFRule {
  /** Unique identifier (UUID). */
  id: string
  /** Optional user-facing label. */
  name?: string
  /** A1-notation range this rule applies to (e.g. "A1:D100"). */
  range: string
  /** The condition to evaluate for each cell in the range. */
  condition: CFCondition
  /** The format to apply when the condition is met. */
  format: CFFormat
  /**
   * Priority index (lower = applied first / wins over lower-priority rules).
   * Rules are sorted ascending before evaluation.
   */
  priority: number
  /** Discriminator for visual vs. standard rules. Defaults to "standard". */
  kind?: CFRuleKind
  /** Config for `kind === "data_bar"`. */
  dataBar?: CFDataBarConfig
  /** Config for `kind === "color_scale"`. */
  colorScale?: CFColorScaleConfig
  /** Config for `kind === "icon_set"`. */
  iconSet?: CFIconSetConfig
}

/**
 * Snapshot of a cell's original style properties, saved before CF overrides.
 * Used by `applyRulesToSheet` / `stripRulesFromSheet` to restore styles.
 */
export interface CFBackupCell {
  /** Background colour prior to CF. */
  bg?: string
  /** Foreground/text colour prior to CF. */
  fc?: string
  /** Bold (1) or not bold (0). */
  bl?: 0 | 1
  /** Italic (1) or not italic (0). */
  it?: 0 | 1
  /** Display value prior to CF (used by icon_set to restore the original display). */
  m?: string
}

/** A preset fill + text colour combo shown in the "Highlight Rules" quick-pick. */
export interface CFFormatPreset {
  label: string
  /** Background fill colour (hex). */
  fill: string
  /** Text colour (hex). */
  color: string
  bold?: boolean
}

/** A named cell style preset for the "Cell Styles" quick-apply gallery. */
export interface CFCellStylePreset {
  label: string
  fill?: string
  color?: string
  bold?: boolean
  fontSize?: number
}
