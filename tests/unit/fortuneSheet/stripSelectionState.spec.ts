import { describe, it, expect } from 'vitest'
import type { Sheet } from '@fortune-sheet/core'
import { stripSelectionState } from '@/lib/fortuneSheet'

/**
 * Pins the drag-fill/selection desync fix: FortuneSheet round-trips
 * `luckysheet_select_save` through onChange and restores it RAW on remount,
 * leaving the visible selection box (and the fill handle on its corner) at a
 * STALE cell. Sheets handed to the Workbook must carry no selection snapshot.
 */
describe('stripSelectionState', () => {
  it('removes the selection snapshot keys, preserving everything else', () => {
    const sheet = {
      id: 's1',
      name: 'Sheet1',
      data: [[{ v: 1, m: '1' }]],
      luckysheet_select_save: [{ row: [2, 2], column: [20, 20] }],
      luckysheet_selection_range: [{ row: [2, 2], column: [20, 20] }],
    } as unknown as Sheet
    const [out] = stripSelectionState([sheet])
    const rec = out as unknown as Record<string, unknown>
    expect(rec['luckysheet_select_save']).toBeUndefined()
    expect(rec['luckysheet_selection_range']).toBeUndefined()
    expect(rec['id']).toBe('s1')
    expect(rec['data']).toEqual([[{ v: 1, m: '1' }]])
  })

  it('is a no-op for sheets without a snapshot', () => {
    const sheet = { id: 's1', name: 'Sheet1', data: [] } as unknown as Sheet
    expect(() => stripSelectionState([sheet])).not.toThrow()
    expect((sheet as unknown as Record<string, unknown>)['id']).toBe('s1')
  })
})
