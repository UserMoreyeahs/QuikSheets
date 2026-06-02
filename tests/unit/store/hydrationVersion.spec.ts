/**
 * Regression test for the "refresh-on-type" production bug.
 *
 * Symptom: typing into a cell caused the WorkbookComponent to remount
 * (because `workbookStructureKey` embeds `hydrationVersion`, which used
 * to bump on every `setGridSheets` call → key change → unmount → the
 * in-progress edit was lost before the next keystroke could commit).
 *
 * Contract pinned here:
 *   - `setGridSheets` does NOT bump `hydrationVersion`
 *     (it's used by `handleChange` for incremental writes FortuneSheet
 *     already knows about).
 *   - `replaceGridSheets` DOES bump `hydrationVersion`
 *     (it's used for wholesale replacements that FortuneSheet's
 *     internal state hasn't seen — import, paste, restore, CF apply).
 *
 * Breaking either side of this contract regresses the prod bug.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSheetStore } from '@/store/sheetStore'
import type { Sheet } from '@fortune-sheet/core'

function makeSheet(name = 'Sheet1', id = 'sheet1'): Sheet {
  return {
    name,
    id,
    order: 0,
    status: 1 as const,
    config: {},
    data: [],
    celldata: [],
  }
}

describe('sheetStore hydrationVersion contract', () => {
  beforeEach(() => {
    // Reset to a known baseline before each test.
    useSheetStore.getState().setGridSheets([makeSheet()])
  })

  it('setGridSheets does NOT bump hydrationVersion', () => {
    const before = useSheetStore.getState().hydrationVersion
    useSheetStore.getState().setGridSheets([makeSheet('Sheet1', 'sheet1')])
    const after = useSheetStore.getState().hydrationVersion
    expect(after).toBe(before)
  })

  it('setGridSheets called 50 times does not bump hydrationVersion (per-keystroke scenario)', () => {
    const before = useSheetStore.getState().hydrationVersion
    for (let i = 0; i < 50; i += 1) {
      useSheetStore.getState().setGridSheets([makeSheet('Sheet1', 'sheet1')])
    }
    const after = useSheetStore.getState().hydrationVersion
    expect(after).toBe(before)
  })

  it('replaceGridSheets bumps hydrationVersion by exactly 1', () => {
    const before = useSheetStore.getState().hydrationVersion
    useSheetStore.getState().replaceGridSheets([makeSheet('Sheet1', 'sheet1')])
    const after = useSheetStore.getState().hydrationVersion
    expect(after).toBe(before + 1)
  })

  it('replaceGridSheets called 3 times bumps hydrationVersion by 3', () => {
    const before = useSheetStore.getState().hydrationVersion
    for (let i = 0; i < 3; i += 1) {
      useSheetStore.getState().replaceGridSheets([makeSheet('Sheet1', 'sheet1')])
    }
    const after = useSheetStore.getState().hydrationVersion
    expect(after).toBe(before + 3)
  })

  it('setGridSheets still updates gridSheets (no functional regression)', () => {
    const next = [makeSheet('Renamed', 'sheet1')]
    useSheetStore.getState().setGridSheets(next)
    expect(useSheetStore.getState().gridSheets[0]?.name).toBe('Renamed')
  })

  it('replaceGridSheets still updates gridSheets (no functional regression)', () => {
    const next = [makeSheet('Replaced', 'sheet1')]
    useSheetStore.getState().replaceGridSheets(next)
    expect(useSheetStore.getState().gridSheets[0]?.name).toBe('Replaced')
  })
})
