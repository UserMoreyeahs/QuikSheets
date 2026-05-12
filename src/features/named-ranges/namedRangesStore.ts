'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface NamedRange {
  /** Excel-faithful name: must start with letter or _, no spaces, no cell-ref look-alikes. */
  name: string
  /** Range like "Sheet1!A1:C10" or "A1:C10" (workbook-scoped). */
  range: string
  /** 'workbook' = visible in all sheets, sheetId = visible only in that sheet. */
  scope: string
  /** Optional comment / description. */
  comment?: string
}

interface NamedRangesState {
  workbookId: string | null
  /** Names keyed by workbookId. */
  names: Record<string, NamedRange[]>
  dialogOpen: boolean
}

interface NamedRangesActions {
  loadNames: (workbookId: string) => void
  addName: (workbookId: string, named: NamedRange) => void
  updateName: (workbookId: string, originalName: string, named: NamedRange) => void
  deleteName: (workbookId: string, name: string) => void
  getNamesForWorkbook: (workbookId: string) => NamedRange[]
  setDialogOpen: (open: boolean) => void
}

const STORAGE_PREFIX = 'quiksheets_named_ranges:'

function loadFromStorage(workbookId: string): NamedRange[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${workbookId}`)
    return raw ? (JSON.parse(raw) as NamedRange[]) : []
  } catch {
    return []
  }
}

function saveToStorage(workbookId: string, names: NamedRange[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${workbookId}`, JSON.stringify(names))
  } catch { /* localStorage unavailable */ }
}

/**
 * Excel name validation. Names must:
 * - Start with letter or underscore
 * - Contain only letters, digits, underscores, periods (no spaces)
 * - Not look like a cell reference (e.g. "A1", "RC", "R1C1")
 * - Not be a single letter "C" or "R"
 * - Be 1-255 characters
 */
export function validateNamedRangeName(name: string): { ok: boolean; error?: string } {
  if (!name) return { ok: false, error: 'Name cannot be empty' }
  if (name.length > 255) return { ok: false, error: 'Name exceeds 255 characters' }
  if (!/^[A-Za-z_]/.test(name)) return { ok: false, error: 'Name must start with letter or underscore' }
  if (!/^[A-Za-z_][\w.]*$/.test(name)) return { ok: false, error: 'Name can only contain letters, digits, _, and .' }
  if (/^[A-Z]+\d+$/i.test(name)) return { ok: false, error: 'Name cannot look like a cell reference' }
  if (/^[CR]$/i.test(name)) return { ok: false, error: 'Name cannot be just "C" or "R"' }
  return { ok: true }
}

export const useNamedRangesStore = create<NamedRangesState & NamedRangesActions>()(
  devtools(
    (set, get) => ({
      workbookId: null,
      names: {},
      dialogOpen: false,

      loadNames(workbookId) {
        const stored = loadFromStorage(workbookId)
        set(
          (state) => ({ workbookId, names: { ...state.names, [workbookId]: stored } }),
          false,
          'names/load',
        )
      },

      addName(workbookId, named) {
        set(
          (state) => {
            const existing = state.names[workbookId] ?? []
            const next = [...existing.filter((n) => n.name !== named.name), named]
            saveToStorage(workbookId, next)
            return { names: { ...state.names, [workbookId]: next } }
          },
          false,
          'names/add',
        )
      },

      updateName(workbookId, originalName, named) {
        set(
          (state) => {
            const existing = state.names[workbookId] ?? []
            const next = existing.map((n) => (n.name === originalName ? named : n))
            saveToStorage(workbookId, next)
            return { names: { ...state.names, [workbookId]: next } }
          },
          false,
          'names/update',
        )
      },

      deleteName(workbookId, name) {
        set(
          (state) => {
            const existing = state.names[workbookId] ?? []
            const next = existing.filter((n) => n.name !== name)
            saveToStorage(workbookId, next)
            return { names: { ...state.names, [workbookId]: next } }
          },
          false,
          'names/delete',
        )
      },

      getNamesForWorkbook(workbookId) {
        return get().names[workbookId] ?? []
      },

      setDialogOpen(dialogOpen) {
        set({ dialogOpen }, false, 'names/setDialogOpen')
      },
    }),
    { name: 'NamedRangesStore' },
  ),
)
