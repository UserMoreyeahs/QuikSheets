/**
 * Unit tests for src/features/row-rls/utils/rowRlsEvaluator.ts
 *
 * Coverage:
 *   - All 6 predicate operators: equals, not_equals, contains, in,
 *     matches_user_id, matches_user_email
 *   - All 4 scope kinds: viewers, editors, specific_users, specific_roles
 *   - Owner-always-sees-all short-circuit
 *   - Unauthenticated user (userRole = null, userId = null)
 *   - Header row (row 0) is never hidden
 *   - Disabled rules are skipped
 *   - Multiple rules: intersection semantics
 *   - Empty sheet / single-row sheet
 */

import { describe, it, expect } from 'vitest'
import { evaluateRules } from '@/features/row-rls/utils/rowRlsEvaluator'
import type { RowVisibilityRule, RuleScope } from '@/features/row-rls/types'
import type { Cell } from '@fortune-sheet/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCell(value: string | number | null): Cell | null {
  if (value === null) return null
  return { v: value, m: String(value) } as Cell
}

/**
 * Build a simple 2-D matrix.
 *
 * @param rows - Each element is an array of cell values (row 0 = header).
 */
function makeMatrix(rows: (string | number | null)[][]): (Cell | null)[][] {
  return rows.map((row) => row.map(makeCell))
}

function makeRule(
  overrides: Partial<RowVisibilityRule> & {
    predicateColumn?: number
    predicateOperator?: RowVisibilityRule['predicate']['operator']
    predicateValue?: RowVisibilityRule['predicate']['value']
    scope?: RuleScope
  }
): RowVisibilityRule {
  const {
    predicateColumn = 0,
    predicateOperator = 'equals',
    predicateValue = 'EMEA',
    scope = { kind: 'viewers' },
    ...rest
  } = overrides

  return {
    id: 'rule-1',
    workbookId: 'wb-1',
    sheetId: 'sheet1',
    name: 'Test rule',
    predicate: {
      column: predicateColumn,
      operator: predicateOperator,
      ...(predicateValue !== undefined ? { value: predicateValue } : {}),
    },
    scope,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...rest,
  }
}

// Sample matrix:
//   Row 0: ["Region", "Sales"]   ← header
//   Row 1: ["EMEA", 100]
//   Row 2: ["APAC", 200]
//   Row 3: ["EMEA", 300]
//   Row 4: ["NA", 400]
const SAMPLE_MATRIX = makeMatrix([
  ['Region', 'Sales'],
  ['EMEA', 100],
  ['APAC', 200],
  ['EMEA', 300],
  ['NA', 400],
])

// ---------------------------------------------------------------------------
// Owner bypass
// ---------------------------------------------------------------------------

describe('owner bypass', () => {
  it('returns an empty set for an owner regardless of rules', () => {
    const rule = makeRule({ predicateOperator: 'equals', predicateValue: 'EMEA' })
    const hidden = evaluateRules([rule], 'owner', 'user-1', 'owner@test.com', SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })

  it('returns empty set for owner even when no rules exist', () => {
    const hidden = evaluateRules([], 'owner', 'user-1', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// No matching scope — rule does not apply
// ---------------------------------------------------------------------------

describe('scope mismatch — rule does not apply', () => {
  it('viewers scope does not apply to editors', () => {
    const rule = makeRule({ scope: { kind: 'viewers' } })
    const hidden = evaluateRules([rule], 'editor', 'u1', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })

  it('editors scope does not apply to viewers', () => {
    const rule = makeRule({ scope: { kind: 'editors' } })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })

  it('specific_users scope does not apply to a different user', () => {
    const rule = makeRule({
      scope: { kind: 'specific_users', userIds: ['other-user-id'] },
    })
    const hidden = evaluateRules([rule], 'viewer', 'this-user-id', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })

  it('specific_roles scope does not apply when role is not listed', () => {
    const rule = makeRule({
      scope: { kind: 'specific_roles', roles: ['editor'] },
    })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })

  it('unauthenticated user (role=null) is not matched by any scope', () => {
    const rule = makeRule({ scope: { kind: 'viewers' } })
    const hidden = evaluateRules([rule], null, null, null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Scope matching
// ---------------------------------------------------------------------------

describe('scope — viewers', () => {
  it('applies to a viewer role', () => {
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'viewers' },
    })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    // Rows that are NOT "EMEA" → rows 2 (APAC) and 4 (NA) are hidden
    expect(hidden).toEqual(new Set([2, 4]))
  })
})

describe('scope — editors', () => {
  it('applies to an editor role', () => {
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'editors' },
    })
    const hidden = evaluateRules([rule], 'editor', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4]))
  })
})

describe('scope — specific_users', () => {
  it('applies when userId is in the list', () => {
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'specific_users', userIds: ['target-user'] },
    })
    const hidden = evaluateRules([rule], 'viewer', 'target-user', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4]))
  })

  it('does not apply when userId is not in the list', () => {
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'specific_users', userIds: ['target-user'] },
    })
    const hidden = evaluateRules([rule], 'viewer', 'other-user', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })
})

describe('scope — specific_roles', () => {
  it('applies to viewer when viewer is in roles list', () => {
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'specific_roles', roles: ['viewer', 'editor'] },
    })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4]))
  })

  it('applies to editor when editor is in roles list', () => {
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'specific_roles', roles: ['editor'] },
    })
    const hidden = evaluateRules([rule], 'editor', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4]))
  })
})

// ---------------------------------------------------------------------------
// Predicate operators
// ---------------------------------------------------------------------------

describe('operator: equals', () => {
  it('hides rows where cell does NOT equal the value', () => {
    const rule = makeRule({ predicateOperator: 'equals', predicateValue: 'EMEA' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4])) // APAC and NA are hidden
  })

  it('is case-insensitive', () => {
    const rule = makeRule({ predicateOperator: 'equals', predicateValue: 'emea' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4]))
  })
})

describe('operator: not_equals', () => {
  it('hides rows where cell equals the value (inverse logic)', () => {
    // Predicate: cell != "EMEA" → rows passing = APAC, NA rows
    // hidden (failing) = EMEA rows (1, 3)
    const rule = makeRule({ predicateOperator: 'not_equals', predicateValue: 'EMEA' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([1, 3]))
  })
})

describe('operator: contains', () => {
  it('hides rows where cell does NOT contain the substring', () => {
    // "EA" is in EMEA but not APAC or NA
    const rule = makeRule({ predicateOperator: 'contains', predicateValue: 'EA' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([2, 4]))
  })
})

describe('operator: in', () => {
  it('hides rows where cell is NOT in the allowed list', () => {
    const rule = makeRule({
      predicateOperator: 'in',
      predicateValue: ['EMEA', 'APAC'],
    })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([4])) // only NA is hidden
  })
})

describe('operator: matches_user_id', () => {
  it('hides rows where cell does NOT match the current userId', () => {
    // Matrix col 0: Region strings, but let us build a user-specific matrix
    const userMatrix = makeMatrix([
      ['owner_id', 'data'],
      ['user-abc', 'record A'],
      ['user-xyz', 'record B'],
      ['user-abc', 'record C'],
    ])
    const rule = makeRule({
      predicateColumn: 0,
      predicateOperator: 'matches_user_id',
    })
    const hidden = evaluateRules([rule], 'viewer', 'user-abc', 'a@test.com', userMatrix)
    // Row 2 (user-xyz) is hidden; rows 1 and 3 (user-abc) are visible
    expect(hidden).toEqual(new Set([2]))
  })

  it('hides all rows when userId is null (unauthed)', () => {
    const userMatrix = makeMatrix([
      ['owner_id'],
      ['user-abc'],
      ['user-xyz'],
    ])
    const rule = makeRule({
      predicateColumn: 0,
      predicateOperator: 'matches_user_id',
    })
    // matches_user_id with null userId → predicate always returns false → all rows hidden
    const hidden = evaluateRules([rule], 'viewer', null, null, userMatrix)
    expect(hidden).toEqual(new Set([1, 2]))
  })
})

describe('operator: matches_user_email', () => {
  it('hides rows where cell does NOT match the current userEmail', () => {
    const emailMatrix = makeMatrix([
      ['email', 'data'],
      ['alice@corp.com', 'Alice record'],
      ['bob@corp.com', 'Bob record'],
      ['alice@corp.com', 'Another Alice'],
    ])
    const rule = makeRule({
      predicateColumn: 0,
      predicateOperator: 'matches_user_email',
    })
    const hidden = evaluateRules(
      [rule],
      'viewer',
      'user-1',
      'alice@corp.com',
      emailMatrix
    )
    expect(hidden).toEqual(new Set([2])) // Bob's row is hidden
  })

  it('is case-insensitive for email comparison', () => {
    const emailMatrix = makeMatrix([
      ['email'],
      ['Alice@Corp.COM'],
      ['BOB@CORP.COM'],
    ])
    const rule = makeRule({
      predicateColumn: 0,
      predicateOperator: 'matches_user_email',
    })
    const hidden = evaluateRules(
      [rule],
      'viewer',
      'user-1',
      'alice@corp.com',
      emailMatrix
    )
    expect(hidden).toEqual(new Set([2]))
  })
})

// ---------------------------------------------------------------------------
// Header row safety
// ---------------------------------------------------------------------------

describe('header row (row 0) is never hidden', () => {
  it('does not include row 0 even when predicate fails on header cell', () => {
    const rule = makeRule({ predicateOperator: 'equals', predicateValue: '__nonexistent__' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden.has(0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Disabled rules
// ---------------------------------------------------------------------------

describe('disabled rules are skipped', () => {
  it('does not hide any rows when the only rule is disabled', () => {
    const rule = makeRule({ enabled: false })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Multiple rules — intersection semantics
// ---------------------------------------------------------------------------

describe('multiple rules — intersection', () => {
  it('a row is hidden only when ALL active rules hide it', () => {
    // Rule A: equals "EMEA" → hides rows 2 (APAC) and 4 (NA)
    const ruleA = makeRule({
      id: 'rule-a',
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
    })
    // Rule B: contains "A" → visible: EMEA(EA), APAC(A) → hides rows 1(EMEA has EA), 3(EMEA)
    // Wait: "EMEA" contains "A"? Yes. "APAC" contains "A"? Yes. "NA" contains "A"? Yes.
    // Actually all rows contain "A" via substring → no rows hidden by rule B.
    // Let's use a different rule B: equals "APAC" → hides rows 1(EMEA), 3(EMEA), 4(NA)
    const ruleB = makeRule({
      id: 'rule-b',
      predicateOperator: 'equals',
      predicateValue: 'APAC',
    })
    // Rule A hides: {2, 4}; Rule B hides: {1, 3, 4}
    // Intersection: {4} (only row 4 / NA is hidden by both)
    const hidden = evaluateRules([ruleA, ruleB], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden).toEqual(new Set([4]))
  })

  it('when one rule hides nothing, intersection is empty', () => {
    const ruleA = makeRule({ id: 'rule-a', predicateOperator: 'equals', predicateValue: 'EMEA' })
    // Rule B passes everything: equals "Region" → no data row has "Region" in col 0
    // Actually: row 1=EMEA fails, row 2=APAC fails, row 3=EMEA fails, row 4=NA fails → all hidden
    // Let's flip: predicateValue that all rows satisfy: contains "A"
    const ruleB = makeRule({
      id: 'rule-b',
      predicateOperator: 'contains',
      predicateValue: '',  // empty substring → all cells match → nothing hidden
    })
    const hidden = evaluateRules([ruleA, ruleB], 'viewer', 'u1', null, SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('empty sheet returns empty hidden set', () => {
    const rule = makeRule({ predicateOperator: 'equals', predicateValue: 'EMEA' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, [])
    expect(hidden.size).toBe(0)
  })

  it('single-row sheet (header only) returns empty hidden set', () => {
    const rule = makeRule({ predicateOperator: 'equals', predicateValue: 'EMEA' })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, [
      [makeCell('Region')],
    ])
    expect(hidden.size).toBe(0)
  })

  it('no rules returns empty hidden set', () => {
    const hidden = evaluateRules([], 'viewer', 'u1', 'u1@test.com', SAMPLE_MATRIX)
    expect(hidden.size).toBe(0)
  })

  it('null cells in the predicate column are treated as empty string', () => {
    const matrixWithNulls = makeMatrix([
      ['col'],
      [null],
      ['EMEA'],
    ])
    // equals "EMEA" → row 1 (null, treated as '') fails → hidden
    const rule = makeRule({
      predicateOperator: 'equals',
      predicateValue: 'EMEA',
      scope: { kind: 'viewers' },
    })
    const hidden = evaluateRules([rule], 'viewer', 'u1', null, matrixWithNulls)
    expect(hidden).toEqual(new Set([1]))
  })
})
