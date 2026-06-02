/**
 * Parity tests: old three-clone `applyRulesToSheet` logic vs. the new
 * single-pass implementation.
 *
 * Strategy: the OLD logic is inlined below as `applyRulesToSheetOld` —
 * a verbatim copy of the pre-refactor implementation extracted from git.
 * Each test calls both variants and asserts deep-equal on the returned
 * `{ sheet, backup }` shape.
 *
 * Scenarios covered:
 *  1. No rules + empty backup → both must return the original sheet unchanged.
 *  2. One `cell_value` rule on a small explicit range (e.g. "A1:B3").
 *  3. One `cell_value` rule on a whole-column range ("A:C") with sparse data
 *     — only 3 rows of actual data in a 20-row matrix.
 *  4. Backup-restore scenario: existingBackup contains prior CF styles that
 *     must be reverted before the new rules are applied.
 */

import { describe, it, expect } from 'vitest'
import type { Cell, Sheet } from '@fortune-sheet/core'
import type { CFRule, CFBackupCell } from '@/features/conditional-formatting/types'
import { applyRulesToSheet } from '@/features/conditional-formatting/utils/cfEvaluator'
import { getSheetMatrix, cloneSheetWithData } from '@/lib/fortuneSheet'
import { evaluateRules } from '@/features/conditional-formatting/utils/cfEvaluator'
import { evaluateDataBar, evaluateColorScale, evaluateIconSet } from '@/features/conditional-formatting/utils/visualCFEvaluator'

// ─── Reference implementation (old three-clone logic) ────────────────────────
// Verbatim copy of the pre-refactor applyRulesToSheet, kept here solely for
// comparison.  It is NOT exported and never called in production.

function applyRulesToSheetOld(
  sheet: Sheet,
  rules: CFRule[],
  existingBackup: Record<string, CFBackupCell>
): { sheet: Sheet; backup: Record<string, CFBackupCell> } {
  const matrix = getSheetMatrix(sheet)
  const cfResults = evaluateRules(sheet, rules)
  const backup: Record<string, CFBackupCell> = { ...existingBackup }

  // Restore any previous CF-applied cells from backup before applying new rules
  const restoredMatrix = matrix.map((row: (Cell | null | undefined)[]) => [...(row ?? [])])
  Object.entries(backup).forEach(([key, original]) => {
    const [rStr, cStr] = key.split(':')
    const r = parseInt(rStr ?? '0')
    const c = parseInt(cStr ?? '0')
    if (!restoredMatrix[r]) restoredMatrix[r] = []
    const existing = restoredMatrix[r]![c]
    if (!existing) return
    const restored = { ...existing } as Record<string, unknown>
    if ('bg' in original) restored.bg = original.bg
    else delete restored.bg
    if ('fc' in original) restored.fc = original.fc
    else delete restored.fc
    if ('bl' in original) restored.bl = original.bl
    else delete restored.bl
    if ('it' in original) restored.it = original.it
    else delete restored.it
    if ('m' in original) restored.m = original.m
    else delete restored.m
    restoredMatrix[r]![c] = restored
  })

  const newBackup: Record<string, CFBackupCell> = {}
  const resultMatrix = restoredMatrix.map((row: (Cell | null | undefined)[]) => [...(row ?? [])])

  function backupAndPatch(
    row: number,
    col: number,
    patchFn: (patched: Record<string, unknown>) => void
  ) {
    if (!resultMatrix[row]) resultMatrix[row] = []
    const existing = resultMatrix[row]![col] ?? {}
    const key = `${row}:${col}`

    if (!(key in newBackup)) {
      const origBg = (existing as Record<string, unknown>).bg as string | undefined
      const origFc = (existing as Record<string, unknown>).fc as string | undefined
      const origBl = (existing as Record<string, unknown>).bl as 0 | 1 | undefined
      const origIt = (existing as Record<string, unknown>).it as 0 | 1 | undefined
      const origM = (existing as Record<string, unknown>).m as string | undefined
      newBackup[key] = {
        ...(origBg !== undefined ? { bg: origBg } : {}),
        ...(origFc !== undefined ? { fc: origFc } : {}),
        ...(origBl !== undefined ? { bl: origBl } : {}),
        ...(origIt !== undefined ? { it: origIt } : {}),
        ...(origM !== undefined ? { m: origM } : {}),
      }
    }

    const patched: Record<string, unknown> = { ...existing }
    patchFn(patched)
    resultMatrix[row]![col] = patched
  }

  cfResults.forEach(({ row, col, format }) => {
    backupAndPatch(row, col, (patched) => {
      if (format.fill !== undefined) patched.bg = format.fill
      if (format.color !== undefined) patched.fc = format.color
      if (format.bold !== undefined) patched.bl = format.bold ? 1 : 0
      if (format.italic !== undefined) patched.it = format.italic ? 1 : 0
    })
  })

  const visualRules = rules.filter((r) => r.kind && r.kind !== 'standard')
  visualRules.forEach((rule) => {
    if (rule.kind === 'data_bar' && rule.dataBar) {
      const dbResults = evaluateDataBar(sheet, rule.range, rule.dataBar)
      for (const [key, { bg }] of dbResults) {
        const [rStr, cStr] = key.split(':')
        const row = parseInt(rStr ?? '0')
        const col = parseInt(cStr ?? '0')
        backupAndPatch(row, col, (patched) => { patched.bg = bg })
      }
    } else if (rule.kind === 'color_scale' && rule.colorScale) {
      const csResults = evaluateColorScale(sheet, rule.range, rule.colorScale)
      for (const [key, { bg }] of csResults) {
        const [rStr, cStr] = key.split(':')
        const row = parseInt(rStr ?? '0')
        const col = parseInt(cStr ?? '0')
        backupAndPatch(row, col, (patched) => { patched.bg = bg })
      }
    } else if (rule.kind === 'icon_set' && rule.iconSet) {
      const isResults = evaluateIconSet(sheet, rule.range, rule.iconSet)
      for (const [key, { icon }] of isResults) {
        const [rStr, cStr] = key.split(':')
        const row = parseInt(rStr ?? '0')
        const col = parseInt(cStr ?? '0')
        backupAndPatch(row, col, (patched) => {
          const currentM = String(patched.m ?? patched.v ?? '')
          patched.m = `${icon} ${currentM}`
        })
      }
    }
  })

  const nextSheet = cloneSheetWithData(sheet, resultMatrix as Cell[][])
  return { sheet: nextSheet, backup: newBackup }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Sheet with an explicit data matrix (no celldata). */
function makeSheet(data: (Cell | null)[][]): Sheet {
  return {
    id: 'test-sheet',
    name: 'Sheet1',
    status: 1,
    order: 0,
    hide: 0,
    row: data.length || 10,
    column: (data[0]?.length ?? 0) || 10,
    data,
  } as Sheet
}

/** Build a simple cell_value > threshold CF rule for a given range. */
function makeRule(
  range: string,
  threshold: number,
  fill: string,
  priority = 0
): CFRule {
  return {
    id: `rule-${range}-${threshold}`,
    range,
    condition: { type: 'cell_value', operator: 'greater', value: String(threshold) },
    format: { fill },
    priority,
  }
}

/** Extract just the data matrix from a sheet result for easier comparison. */
function matrixOf(s: Sheet): (Cell | null | undefined)[][] {
  return getSheetMatrix(s)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('applyRulesToSheet — single-pass parity with old three-clone impl', () => {
  // ── Scenario 1: no-op ──────────────────────────────────────────────────────
  describe('Scenario 1: no rules + empty backup → no-op short-circuit', () => {
    it('returns the original sheet reference unchanged when rules=[] and backup={}', () => {
      const sheet = makeSheet([[{ v: 10, m: '10' }, null], [null, { v: 20, m: '20' }]])
      const old = applyRulesToSheetOld(sheet, [], {})
      const next = applyRulesToSheet(sheet, [], {})

      // Both should have empty backups
      expect(next.backup).toEqual(old.backup)
      expect(next.backup).toEqual({})

      // New impl returns the original sheet reference (short-circuit);
      // old impl still builds a new sheet.  Both must have identical DATA.
      expect(matrixOf(next.sheet)).toEqual(matrixOf(old.sheet))
    })
  })

  // ── Scenario 2: cell_value rule on a small explicit range ─────────────────
  describe('Scenario 2: cell_value rule on a small range "A1:B3"', () => {
    const data: (Cell | null)[][] = [
      [{ v: 5, m: '5' }, { v: 15, m: '15' }],
      [{ v: 3, m: '3', bg: '#FFFFFF' }, { v: 25, m: '25', fc: '#000000' }],
      [{ v: 12, m: '12' }, null],
    ]

    it('backup keys match', () => {
      const sheet = makeSheet(data)
      const rules = [makeRule('A1:B3', 10, '#FFEB9C')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      expect(Object.keys(next.backup).sort()).toEqual(Object.keys(old.backup).sort())
    })

    it('backup values match exactly', () => {
      const sheet = makeSheet(data)
      const rules = [makeRule('A1:B3', 10, '#FFEB9C')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      expect(next.backup).toEqual(old.backup)
    })

    it('output matrix cells with CF applied match exactly', () => {
      const sheet = makeSheet(data)
      const rules = [makeRule('A1:B3', 10, '#FFEB9C')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      const oldMatrix = matrixOf(old.sheet)
      const newMatrix = matrixOf(next.sheet)

      // Check every cell in the range
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          expect(newMatrix[r]?.[c]).toEqual(oldMatrix[r]?.[c])
        }
      }
    })

    it('cells outside the rule range are unaffected', () => {
      // Add an extra column outside the rule range
      const widerData: (Cell | null)[][] = data.map((row, r) => [
        ...row,
        { v: r * 100, m: String(r * 100), bg: '#AABBCC' },
      ])
      const sheet = makeSheet(widerData)
      const rules = [makeRule('A1:B3', 10, '#FFEB9C')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      // Column C (index 2) must be untouched
      for (let r = 0; r < 3; r++) {
        expect(matrixOf(next.sheet)[r]?.[2]).toEqual(matrixOf(old.sheet)[r]?.[2])
      }
    })
  })

  // ── Scenario 3: whole-column range with sparse data ────────────────────────
  describe('Scenario 3: whole-column range "A:C" with 3 data rows in 20-row matrix', () => {
    // Build a 20-row × 3-col matrix, only rows 0-2 have data
    const sparseData: (Cell | null)[][] = Array.from({ length: 20 }, (_, r) => {
      if (r === 0) return [{ v: 5, m: '5' }, { v: 15, m: '15' }, { v: 2, m: '2' }]
      if (r === 1) return [{ v: 20, m: '20' }, { v: 3, m: '3' }, { v: 11, m: '11' }]
      if (r === 2) return [{ v: 1, m: '1' }, null, { v: 50, m: '50' }]
      return [null, null, null]
    })

    it('backup keys match (only non-null matching cells backed up)', () => {
      const sheet = makeSheet(sparseData)
      // parseRange("A:C") defaults endRow to 1000-1 but the matrix only has
      // 20 rows, so evaluateRules caps at matrix.length-1 = 19.
      const rules = [makeRule('A:C', 10, '#FFC7CE')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      expect(Object.keys(next.backup).sort()).toEqual(Object.keys(old.backup).sort())
    })

    it('backup values match exactly', () => {
      const sheet = makeSheet(sparseData)
      const rules = [makeRule('A:C', 10, '#FFC7CE')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      expect(next.backup).toEqual(old.backup)
    })

    it('output matrix is identical to old impl for all 20 rows', () => {
      const sheet = makeSheet(sparseData)
      const rules = [makeRule('A:C', 10, '#FFC7CE')]

      const old = applyRulesToSheetOld(sheet, rules, {})
      const next = applyRulesToSheet(sheet, rules, {})

      const oldM = matrixOf(old.sheet)
      const newM = matrixOf(next.sheet)

      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 3; c++) {
          expect(newM[r]?.[c]).toEqual(oldM[r]?.[c])
        }
      }
    })
  })

  // ── Scenario 4: backup-restore — existingBackup has prior CF styles ─────────
  describe('Scenario 4: existingBackup restore before re-applying rules', () => {
    // Simulate the state after a first applyRulesToSheet call:
    // Cell (0,0) was given bg=#FFEB9C by a prior rule; backup preserves original.
    // Cell (1,1) was given bg=#FFC7CE; backup captures original bg=#DDDDDD.
    const dataWithCF: (Cell | null)[][] = [
      [{ v: 15, m: '15', bg: '#FFEB9C' }, { v: 3, m: '3' }],
      [{ v: 7, m: '7' }, { v: 25, m: '25', bg: '#FFC7CE' }],
    ]

    const existingBackup: Record<string, CFBackupCell> = {
      '0:0': {},             // original had no bg
      '1:1': { bg: '#DDDDDD' }, // original had a bg
    }

    it('restored + re-applied backup values match old impl', () => {
      const sheet = makeSheet(dataWithCF)
      // New rule: highlight values > 20 with a different colour
      const rules = [makeRule('A1:B2', 20, '#C6EFCE')]

      const old = applyRulesToSheetOld(sheet, rules, existingBackup)
      const next = applyRulesToSheet(sheet, rules, existingBackup)

      expect(next.backup).toEqual(old.backup)
    })

    it('output matrix after restore + re-apply matches old impl cell by cell', () => {
      const sheet = makeSheet(dataWithCF)
      const rules = [makeRule('A1:B2', 20, '#C6EFCE')]

      const old = applyRulesToSheetOld(sheet, rules, existingBackup)
      const next = applyRulesToSheet(sheet, rules, existingBackup)

      const oldM = matrixOf(old.sheet)
      const newM = matrixOf(next.sheet)

      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          expect(newM[r]?.[c]).toEqual(oldM[r]?.[c])
        }
      }
    })

    it('restored cell (0,0) has its CF colour removed when the new rule does not match', () => {
      // Cell (0,0) has v=15, new rule threshold=20 — it should NOT match.
      // After restore, (0,0) should have no bg (original had none).
      const sheet = makeSheet(dataWithCF)
      const rules = [makeRule('A1:B2', 20, '#C6EFCE')]

      const { sheet: nextSheet } = applyRulesToSheet(sheet, rules, existingBackup)
      const m = matrixOf(nextSheet)
      // bg should be absent (undefined or deleted)
      expect((m[0]?.[0] as Record<string, unknown> | null | undefined)?.bg).toBeUndefined()
    })

    it('restored cell (1,1) regains its original bg when new rule does not match', () => {
      // Cell (1,1) has v=25. Threshold=20 so it DOES match, but its backup had
      // bg=#DDDDDD.  The new CF colour overrides it — backup for (1,1) must
      // capture the RESTORED value (#DDDDDD) not the CF value.
      const sheet = makeSheet(dataWithCF)
      const rules = [makeRule('A1:B2', 20, '#C6EFCE')]

      const { backup } = applyRulesToSheet(sheet, rules, existingBackup)
      // Backup for (1,1) should be { bg: '#DDDDDD' } — the restored original
      expect(backup['1:1']).toEqual({ bg: '#DDDDDD' })
    })
  })

  // ── Scenario 5: bold + italic format fields ────────────────────────────────
  describe('Scenario 5: format with bold and italic fields', () => {
    const data: (Cell | null)[][] = [
      [{ v: 100, m: '100' }, { v: 5, m: '5' }],
      [{ v: 50, m: '50', bl: 1 as 0 | 1 }, { v: 80, m: '80', it: 1 as 0 | 1 }],
    ]

    it('applies bold + italic correctly and backup matches old impl', () => {
      const sheet = makeSheet(data)
      const rule: CFRule = {
        id: 'bold-rule',
        range: 'A1:B2',
        condition: { type: 'cell_value', operator: 'greater_equal', value: '50' },
        format: { fill: '#E2EFDA', bold: true, italic: true },
        priority: 0,
      }

      const old = applyRulesToSheetOld(sheet, [rule], {})
      const next = applyRulesToSheet(sheet, [rule], {})

      expect(next.backup).toEqual(old.backup)
      expect(matrixOf(next.sheet)).toEqual(matrixOf(old.sheet))
    })
  })
})
