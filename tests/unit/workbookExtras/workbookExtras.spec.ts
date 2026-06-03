/**
 * workbookExtras — persistence of visualization objects (charts, pivots,
 * sparklines, slicers, images, overlays) that previously vanished on reload.
 *
 * Pins: collect/apply round-trips through the real stores; save/load
 * round-trips by workbook id; two workbooks don't share extras; opening a
 * different workbook clears the previous one's objects.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { useImageStore } from '@/features/images/store/imageStore'
import {
  collectWorkbookExtras,
  applyWorkbookExtras,
  saveWorkbookExtras,
  loadWorkbookExtras,
  hasAnyExtras,
} from '@/lib/workbookExtras'

beforeEach(() => {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: () => null,
    length: 0,
  })
  vi.stubGlobal('window', { localStorage })
  applyWorkbookExtras(null) // reset all six stores to []
})

describe('workbookExtras', () => {
  it('apply then collect round-trips items into the real stores', () => {
    applyWorkbookExtras({ charts: [{ id: 'c1', kind: 'bar' }], images: [{ id: 'i1' }] })
    const collected = collectWorkbookExtras()
    expect(collected.charts).toHaveLength(1)
    expect(collected.images).toHaveLength(1)
    // verify it actually hit the live stores
    expect(useChartPanelStore.getState().charts).toHaveLength(1)
    expect(useImageStore.getState().images).toHaveLength(1)
  })

  it('save then load round-trips by workbook id', () => {
    applyWorkbookExtras({ charts: [{ id: 'c1' }] })
    saveWorkbookExtras('wb_1', collectWorkbookExtras())

    // Simulate opening a different (empty) workbook — stores cleared.
    applyWorkbookExtras(null)
    expect(collectWorkbookExtras().charts).toHaveLength(0)

    // Reopen wb_1 — its chart comes back.
    applyWorkbookExtras(loadWorkbookExtras('wb_1'))
    expect(collectWorkbookExtras().charts).toHaveLength(1)
  })

  it('two workbooks do not share visualization objects', () => {
    applyWorkbookExtras({ charts: [{ id: 'A' }] })
    saveWorkbookExtras('wb_A', collectWorkbookExtras())
    applyWorkbookExtras({ charts: [{ id: 'B' }] })
    saveWorkbookExtras('wb_B', collectWorkbookExtras())

    const a = loadWorkbookExtras('wb_A')
    const b = loadWorkbookExtras('wb_B')
    expect((a?.charts[0] as { id: string }).id).toBe('A')
    expect((b?.charts[0] as { id: string }).id).toBe('B')
  })

  it('hasAnyExtras reflects emptiness', () => {
    expect(hasAnyExtras(collectWorkbookExtras())).toBe(false)
    applyWorkbookExtras({ overlays: [{ id: 'o1' }] })
    expect(hasAnyExtras(collectWorkbookExtras())).toBe(true)
  })

  it('loadWorkbookExtras returns null for an unknown workbook', () => {
    expect(loadWorkbookExtras('nope')).toBeNull()
  })
})
