/**
 * Row RLS Evaluator
 *
 * Pure function — no side effects, no imports from Zustand or React.
 * Takes a list of rules, current user context, and a sheet matrix;
 * returns the set of row indexes (0-based) that should be HIDDEN for
 * this user.
 *
 * Algorithm:
 *   1. Filter rules to this sheet (callers normally pass only sheet rules,
 *      but the function is defensive).
 *   2. Discard disabled rules.
 *   3. For each enabled rule, check whether it applies to this user via
 *      `ruleAppliesTo`.
 *   4. For each applicable rule, evaluate the predicate against every data
 *      row (rows >= 1; row 0 is always the header and is never hidden).
 *   5. A row is included in the hidden set when the predicate is FALSE.
 *   6. Multiple applicable rules: a row is hidden only when it is hidden by
 *      ALL applicable rules (intersection). This lets admins stack rules that
 *      together define "show exactly the rows you own".
 *   7. Owner short-circuit: returns an empty Set immediately.
 */

import type { Cell } from '@fortune-sheet/core'
import type { RowVisibilityRule, RulePredicate, RulePredicateOperator, RuleScope } from '../types'

// ---------------------------------------------------------------------------
// Predicate evaluation
// ---------------------------------------------------------------------------

function toCellString(cell: Cell | null | undefined): string {
  if (cell == null) return ''
  const raw = cell.m ?? cell.v
  if (raw === null || raw === undefined) return ''
  return String(raw)
}

function evaluatePredicate(
  predicate: RulePredicate,
  row: (Cell | null | undefined)[],
  userId: string | null,
  userEmail: string | null
): boolean {
  const { column, operator, value } = predicate
  const cell = row[column]
  const cellStr = toCellString(cell).toLowerCase()

  switch (operator as RulePredicateOperator) {
    case 'equals': {
      const target = typeof value === 'string' ? value.toLowerCase() : ''
      return cellStr === target
    }

    case 'not_equals': {
      const target = typeof value === 'string' ? value.toLowerCase() : ''
      return cellStr !== target
    }

    case 'contains': {
      const needle = typeof value === 'string' ? value.toLowerCase() : ''
      return cellStr.includes(needle)
    }

    case 'in': {
      if (!Array.isArray(value)) return false
      return value.map((v) => v.toLowerCase()).includes(cellStr)
    }

    case 'matches_user_id': {
      if (!userId) return false
      return toCellString(cell) === userId
    }

    case 'matches_user_email': {
      if (!userEmail) return false
      return toCellString(cell).toLowerCase() === userEmail.toLowerCase()
    }

    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Scope check — does this rule apply to the current user?
// ---------------------------------------------------------------------------

function ruleAppliesTo(
  scope: RuleScope,
  userRole: 'owner' | 'editor' | 'viewer' | null,
  userId: string | null
): boolean {
  switch (scope.kind) {
    case 'viewers':
      return userRole === 'viewer'

    case 'editors':
      return userRole === 'editor'

    case 'specific_users':
      return userId !== null && scope.userIds.includes(userId)

    case 'specific_roles':
      return (
        userRole !== null &&
        (scope.roles as string[]).includes(userRole)
      )

    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Compute the set of row indexes that should be HIDDEN for the current user.
 *
 * @param rules       - All RowVisibilityRule records for the sheet.
 * @param userRole    - Current user's role on this workbook ('owner' bypasses
 *                      all rules; null = unauthenticated / no membership).
 * @param userId      - Current user's Supabase user ID (null if unauthed).
 * @param userEmail   - Current user's email (null if unauthed).
 * @param sheetMatrix - Full 2-D matrix from `getSheetMatrix(sheet)`.
 *                      Row 0 is treated as the header and is never hidden.
 * @returns Set of 0-based row indexes to hide.
 */
export function evaluateRules(
  rules: RowVisibilityRule[],
  userRole: 'owner' | 'editor' | 'viewer' | null,
  userId: string | null,
  userEmail: string | null,
  sheetMatrix: (Cell | null | undefined)[][]
): Set<number> {
  // Owners always see everything.
  if (userRole === 'owner') return new Set<number>()

  // Filter to enabled rules that apply to this user.
  const applicableRules = rules.filter(
    (r) => r.enabled && ruleAppliesTo(r.scope, userRole, userId)
  )

  if (applicableRules.length === 0) return new Set<number>()

  const rowCount = sheetMatrix.length
  if (rowCount <= 1) return new Set<number>() // only header or empty

  // For each applicable rule, compute the set of rows it hides.
  // A row is hidden by a rule when the predicate is FALSE for that row.
  const hiddenSets: Set<number>[] = applicableRules.map((rule) => {
    const hidden = new Set<number>()
    for (let r = 1; r < rowCount; r++) {
      const row = sheetMatrix[r] ?? []
      const passes = evaluatePredicate(rule.predicate, row, userId, userEmail)
      if (!passes) hidden.add(r)
    }
    return hidden
  })

  if (hiddenSets.length === 1) return hiddenSets[0]!

  // Intersection: a row is hidden only when ALL rules hide it.
  const [first, ...rest] = hiddenSets as [Set<number>, ...Set<number>[]]
  const intersection = new Set<number>()
  for (const rowIdx of first) {
    if (rest.every((s) => s.has(rowIdx))) {
      intersection.add(rowIdx)
    }
  }
  return intersection
}
