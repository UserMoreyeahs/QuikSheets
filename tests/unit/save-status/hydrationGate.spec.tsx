/**
 * Pins the autosave HYDRATION GATE: SaveStatus must not arm an autosave
 * before the mount-time hydration finishes. Without the gate, the
 * name-load effect changed props right after mount and a 2s-debounced save
 * of the PRISTINE EMPTY grid raced the server GET — overwriting the user's
 * saved workbook with emptiness ("refresh lost everything").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { act } from 'react'

const debouncedSave = vi.fn()
vi.mock('@/lib/saveService', () => ({
  debouncedSave: (...args: unknown[]) => debouncedSave(...args),
  saveWorkbook: vi.fn(async () => ({ id: 'wb', destination: 'supabase' })),
  flushPendingSave: vi.fn(),
}))

import { SaveStatus } from '@/features/grid/components/SaveStatus'
import { useSheetStore } from '@/store/sheetStore'

beforeEach(() => {
  debouncedSave.mockClear()
  act(() => {
    useSheetStore.getState().setHydrated(false)
  })
})

describe('SaveStatus autosave hydration gate', () => {
  it('does NOT autosave on data changes before hydration completes', () => {
    const { rerender } = render(
      <SaveStatus workbookId="wb" workbookName="Name" workbookData={[1]} />,
    )
    // Simulate the mount-time name/data churn that used to arm the killer save.
    rerender(<SaveStatus workbookId="wb" workbookName="Loaded Name" workbookData={[1]} />)
    rerender(<SaveStatus workbookId="wb" workbookName="Loaded Name" workbookData={[2]} />)
    expect(debouncedSave).not.toHaveBeenCalled()
  })

  it('arms ONE autosave with the current data when hydration completes', () => {
    const { rerender } = render(
      <SaveStatus workbookId="wb" workbookName="Name" workbookData={[1]} />,
    )
    rerender(<SaveStatus workbookId="wb" workbookName="Name" workbookData={[2]} />)
    expect(debouncedSave).not.toHaveBeenCalled()

    act(() => {
      useSheetStore.getState().setHydrated(true)
    })
    expect(debouncedSave).toHaveBeenCalledTimes(1)
    const payload = debouncedSave.mock.calls[0]?.[0] as { data: unknown }
    expect(payload.data).toEqual([2]) // the REAL (latest) data, not a stale snapshot
  })

  it('autosaves normally on changes after hydration', () => {
    act(() => {
      useSheetStore.getState().setHydrated(true)
    })
    const { rerender } = render(
      <SaveStatus workbookId="wb" workbookName="Name" workbookData={[1]} />,
    )
    rerender(<SaveStatus workbookId="wb" workbookName="Name" workbookData={[2]} />)
    expect(debouncedSave).toHaveBeenCalled()
  })
})
