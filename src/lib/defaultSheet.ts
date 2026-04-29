import type { Sheet } from '@fortune-sheet/core'
import { DEFAULT_ROWS, DEFAULT_COLS } from '@/lib/constants'

export function createDefaultSheet(
  name: string = 'Sheet1',
  id: string = 'sheet1'
): Sheet {
  return {
    name,
    id,
    status: 1,
    order: 0,
    hide: 0,
    row: DEFAULT_ROWS,
    column: DEFAULT_COLS,
    celldata: [],
  }
}

export function createDefaultWorkbook(): Sheet[] {
  return [createDefaultSheet('Sheet1', 'sheet1')]
}
