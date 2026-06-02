/**
 * Row-Level Security (Row RLS) Type Definitions
 *
 * These types model per-user row-visibility rules for Quiksheets.
 * A `RowVisibilityRule` is evaluated at runtime against the current user's
 * identity and role to produce a set of row indexes that should be hidden.
 *
 * Semantics:
 *   - Owner always sees ALL rows regardless of rules.
 *   - A rule is ACTIVE for a user when its `scope` includes that user's role
 *     or user ID.
 *   - When a rule is active, each row is evaluated against `predicate`.
 *     Rows for which the predicate evaluates FALSE are HIDDEN.
 *   - Multiple active rules use intersection semantics: a row is hidden when
 *     ALL active rules hide it. In practice most sheets have one rule.
 */

// ---------------------------------------------------------------------------
// Predicate
// ---------------------------------------------------------------------------

/**
 * Operators:
 *   - `equals`             — Cell value === rule value (case-insensitive string)
 *   - `not_equals`         — Cell value !== rule value
 *   - `contains`           — Cell string value contains rule value substring
 *   - `in`                 — Cell value is one of the values in `value` (array)
 *   - `matches_user_id`    — Cell value === current user's Supabase user.id
 *   - `matches_user_email` — Cell value === current user's email address
 */
export type RulePredicateOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'in'
  | 'matches_user_id'
  | 'matches_user_email'

/**
 * Predicate evaluated against a single cell in each data row.
 *
 * `column` is a 0-based column index.
 * `value` is required for `equals`, `not_equals`, `contains` (string) and
 * `in` (string[]). Omit for `matches_user_id` / `matches_user_email`.
 */
export interface RulePredicate {
  /** 0-based column index whose cell value is tested. */
  column: number
  /** Comparison operator. */
  operator: RulePredicateOperator
  /**
   * Comparison value.
   *   - string for `equals`, `not_equals`, `contains`
   *   - string[] for `in`
   *   - omit for `matches_user_id` / `matches_user_email`
   */
  value?: string | string[]
}

// ---------------------------------------------------------------------------
// Scope — which users does this rule apply to?
// ---------------------------------------------------------------------------

/** The rule applies to all users with the "viewer" role on this workbook. */
interface ScopeViewers {
  kind: 'viewers'
}

/** The rule applies to all users with the "editor" role on this workbook. */
interface ScopeEditors {
  kind: 'editors'
}

/** The rule applies to specific users, identified by Supabase user ID. */
interface ScopeSpecificUsers {
  kind: 'specific_users'
  userIds: string[]
}

/** The rule applies to users whose workbook role is one of the listed roles. */
interface ScopeSpecificRoles {
  kind: 'specific_roles'
  roles: Array<'viewer' | 'editor'>
}

export type RuleScope =
  | ScopeViewers
  | ScopeEditors
  | ScopeSpecificUsers
  | ScopeSpecificRoles

// ---------------------------------------------------------------------------
// RowVisibilityRule — top-level entity
// ---------------------------------------------------------------------------

/**
 * A single Row Visibility rule.
 *
 * Stored in useRowRlsStore and persisted to the `row_visibility_rules` table.
 *
 * Evaluation contract:
 *   For each data row (row index >= 1; row 0 is always the header), evaluate
 *   `predicate` against the cell in `predicate.column`. If the predicate is
 *   FALSE, the row is HIDDEN for any user whose role/id falls within `scope`.
 *   Owners bypass all rules unconditionally.
 */
export interface RowVisibilityRule {
  /** UUID — used as React key and for delete-by-id. */
  id: string
  /** Workbook this rule belongs to. */
  workbookId: string
  /** Sheet this rule applies to. */
  sheetId: string
  /** User-facing label, e.g. "Only see your own leads". */
  name: string
  /** Column + operator + value that each row must satisfy to remain visible. */
  predicate: RulePredicate
  /** Who is subject to this rule. */
  scope: RuleScope
  /** Whether this rule is currently active. */
  enabled: boolean
  /** ISO-8601 timestamp. */
  createdAt: string
  /** ISO-8601 timestamp. */
  updatedAt: string
}
