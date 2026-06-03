'use client'

/**
 * localStorage-backed protected-ranges store.  Mirrors the Supabase schema's
 * shape so the same UI works in both modes.
 */

export interface LocalProtectedRange {
  id: string
  workbookId: string
  sheetId: string
  rangeRef: string  // A1:B5 form
  description: string | null
  createdAt: number
}

const KEY = (workbookId: string) => `quiksheets_protected_ranges:${workbookId}`

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

function readAll(workbookId: string): LocalProtectedRange[] {
  if (typeof window === 'undefined') return []
  return safeParse<LocalProtectedRange[]>(localStorage.getItem(KEY(workbookId))) ?? []
}

function writeAll(workbookId: string, list: LocalProtectedRange[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY(workbookId), JSON.stringify(list))
}

export function listLocalProtectedRanges(workbookId: string): LocalProtectedRange[] {
  return readAll(workbookId).sort((a, b) => b.createdAt - a.createdAt)
}

export function listLocalProtectedRangesForSheet(
  workbookId: string,
  sheetId: string
): LocalProtectedRange[] {
  return listLocalProtectedRanges(workbookId).filter((r) => r.sheetId === sheetId)
}

export function addLocalProtectedRange(input: {
  workbookId: string
  sheetId: string
  rangeRef: string
  description?: string | null
}): LocalProtectedRange {
  const list = readAll(input.workbookId)
  const range: LocalProtectedRange = {
    id: crypto.randomUUID(),
    workbookId: input.workbookId,
    sheetId: input.sheetId,
    rangeRef: input.rangeRef.trim().toUpperCase(),
    description: input.description?.trim() || null,
    createdAt: Date.now(),
  }
  list.unshift(range)
  writeAll(input.workbookId, list)
  return range
}

export function deleteLocalProtectedRange(workbookId: string, id: string): void {
  writeAll(workbookId, readAll(workbookId).filter((r) => r.id !== id))
}

// ── Edit-blocking helpers ────────────────────────────────────────────────────

import { parseA1Range } from '@/features/charts/utils/rangeUtils'

/**
 * Returns true if the given cell (row,col) on `sheetId` is inside any
 * protected range for this workbook.  Used by the grid's onChange handler
 * to block edits client-side.
 */
export function isCellProtected(
  workbookId: string,
  sheetId: string,
  row: number,
  col: number
): boolean {
  for (const r of listLocalProtectedRangesForSheet(workbookId, sheetId)) {
    const bounds = parseA1Range(r.rangeRef)
    if (!bounds) continue
    if (
      row >= bounds.rowStart &&
      row <= bounds.rowEnd &&
      col >= bounds.colStart &&
      col <= bounds.colEnd
    ) return true
  }
  return false
}

/** All ranges as parsed bounds — useful for the grid to draw outlines. */
export function getProtectedBounds(workbookId: string, sheetId: string) {
  return listLocalProtectedRangesForSheet(workbookId, sheetId)
    .map((r) => ({ id: r.id, bounds: parseA1Range(r.rangeRef), description: r.description }))
    .filter((x) => x.bounds !== null)
}
