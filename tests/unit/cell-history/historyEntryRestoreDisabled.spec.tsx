import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoryEntry } from '@/features/cell-history/components/HistoryEntry'
import { restoreCell } from '@/features/cell-history/services/historyService'

/**
 * Pins the T025 fix: per-cell restore is a stub (restoreCell → null), so the
 * Cell History panel's Restore button must be DISABLED — the prior behavior
 * (confirm dialog → silent no-op) is the regression this guards against.
 * Re-enable only alongside a real restoreCell implementation.
 */
describe('HistoryEntry restore button (T025)', () => {
  it('restoreCell is still a stub returning null', async () => {
    expect(await restoreCell('any-id')).toBeNull()
  })

  it('renders the Restore button disabled while restoreCell is a stub', () => {
    render(
      <HistoryEntry
        entry={{
          id: 'h1',
          workbook_id: 'wb',
          sheet_id: 's1',
          cell_address: 'A1',
          old_value: '1',
          new_value: '2',
          changed_by: 'user-1',
          changed_at: new Date().toISOString(),
        }}
        isRestoring={false}
        onRestore={() => {
          throw new Error('onRestore must not be reachable while restore is stubbed')
        }}
      />,
    )
    const button = screen.getByRole('button', { name: /restore to this value/i })
    expect(button).toBeDisabled()
  })
})
