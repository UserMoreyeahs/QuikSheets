import type { SortConfig, SortDirection } from '@/types/sheet.types'

export interface RowData {
  rowIndex: number
  cells: Record<number, string | number | boolean | null>
}

export function sortRows(rows: RowData[], config: SortConfig): RowData[] {
  return [...rows].sort((a, b) => {
    const aVal = a.cells[config.columnIndex]
    const bVal = b.cells[config.columnIndex]

    if (aVal === null || aVal === undefined || aVal === '') return 1
    if (bVal === null || bVal === undefined || bVal === '') return -1

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return config.direction === 'asc' ? aVal - bVal : bVal - aVal
    }

    const aNum = Number(aVal)
    const bNum = Number(bVal)
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return config.direction === 'asc' ? aNum - bNum : bNum - aNum
    }

    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    const comparison = aStr.localeCompare(bStr)
    return config.direction === 'asc' ? comparison : -comparison
  })
}

export function nextSortDirection(
  current: SortDirection | null
): SortDirection | null {
  if (current === null) return 'asc'
  if (current === 'asc') return 'desc'
  return null
}
