import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { SheetTab, WorkbookState } from '@/types/sheet.types'

interface WorkbookActions {
  addSheet: (name?: string) => void
  replaceSheets: (sheets: SheetTab[], activeSheetId: string) => void
  removeSheet: (id: string) => void
  setActiveSheet: (id: string) => void
  renameSheet: (id: string, name: string) => void
  duplicateSheet: (id: string) => void
  hideSheet: (id: string) => void
  setSheetColor: (id: string, color: string | null) => void
  moveSheet: (id: string, direction: 'left' | 'right') => void
  reorderSheets: (fromId: string, toId: string) => void
}

function generateId(): string {
  return `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function generateSheetName(sheets: SheetTab[]): string {
  const existing = new Set(sheets.map((s) => s.name))
  let n = sheets.length + 1
  while (existing.has(`Sheet${n}`)) n++
  return `Sheet${n}`
}

function ensureUniqueSheetName(name: string, sheets: SheetTab[], excludeId?: string): string {
  const trimmed = name.trim()
  const baseName = trimmed || 'Sheet'
  const existing = new Set(
    sheets
      .filter((sheet) => sheet.id !== excludeId)
      .map((sheet) => sheet.name.toLowerCase())
  )

  if (!existing.has(baseName.toLowerCase())) {
    return baseName
  }

  let suffix = 2
  let candidate = `${baseName} (${suffix})`
  while (existing.has(candidate.toLowerCase())) {
    suffix += 1
    candidate = `${baseName} (${suffix})`
  }

  return candidate
}

const initialSheets: SheetTab[] = [
  { id: 'sheet1', name: 'Sheet1', color: null, isHidden: false, order: 0 },
]

const initialState: WorkbookState = {
  sheets: initialSheets,
  activeSheetId: 'sheet1',
}

export const useWorkbookStore = create<WorkbookState & WorkbookActions>()(
  devtools(
    (set) => ({
      ...initialState,

      addSheet: (name) =>
        set((state) => {
          const id = generateId()
          const sheetName = name
            ? ensureUniqueSheetName(name, state.sheets)
            : generateSheetName(state.sheets)
          const order = state.sheets.length
          const newSheet: SheetTab = {
            id,
            name: sheetName,
            color: null,
            isHidden: false,
            order,
          }
          return {
            sheets: [...state.sheets, newSheet],
            activeSheetId: id,
          }
        }),

      replaceSheets: (sheets, activeSheetId) =>
        set(() => {
          const normalizedSheets = sheets.map((sheet, index) => ({
            ...sheet,
            order: index,
          }))
          const nextActiveSheetId = normalizedSheets.some((sheet) => sheet.id === activeSheetId)
            ? activeSheetId
            : (normalizedSheets[0]?.id ?? activeSheetId)

          return {
            sheets: normalizedSheets,
            activeSheetId: nextActiveSheetId,
          }
        }),

      removeSheet: (id) =>
        set((state) => {
          if (state.sheets.length <= 1) return state
          const remaining = state.sheets
            .filter((s) => s.id !== id)
            .map((s, i) => ({ ...s, order: i }))
          const newActiveId =
            state.activeSheetId === id
              ? (remaining[0]?.id ?? state.activeSheetId)
              : state.activeSheetId
          return { sheets: remaining, activeSheetId: newActiveId }
        }),

      setActiveSheet: (id) =>
        set((state) => {
          const exists = state.sheets.some((s) => s.id === id)
          if (!exists) return state
          return { activeSheetId: id }
        }),

      renameSheet: (id, name) =>
        set((state) => ({
          sheets: state.sheets.map((s) =>
            s.id === id
              ? { ...s, name: ensureUniqueSheetName(name, state.sheets, id) }
              : s
          ),
        })),

      duplicateSheet: (id) =>
        set((state) => {
          const source = state.sheets.find((s) => s.id === id)
          if (!source) return state
          const newId = generateId()
          const newName = ensureUniqueSheetName(`${source.name} Copy`, state.sheets)
          const newSheet: SheetTab = {
            id: newId,
            name: newName,
            color: source.color,
            isHidden: false,
            order: state.sheets.length,
          }
          return {
            sheets: [...state.sheets, newSheet],
            activeSheetId: newId,
          }
        }),

      hideSheet: (id) =>
        set((state) => {
          const visible = state.sheets.filter((s) => !s.isHidden && s.id !== id)
          if (visible.length === 0) return state
          const newSheets = state.sheets.map((s) =>
            s.id === id ? { ...s, isHidden: !s.isHidden } : s
          )
          const newActiveId =
            state.activeSheetId === id
              ? (visible[0]?.id ?? state.activeSheetId)
              : state.activeSheetId
          return { sheets: newSheets, activeSheetId: newActiveId }
        }),

      setSheetColor: (id, color) =>
        set((state) => ({
          sheets: state.sheets.map((s) =>
            s.id === id ? { ...s, color } : s
          ),
        })),

      moveSheet: (id, direction) =>
        set((state) => {
          const sorted = [...state.sheets].sort((a, b) => a.order - b.order)
          const idx = sorted.findIndex((s) => s.id === id)
          if (idx === -1) return state
          const swapIdx = direction === 'left' ? idx - 1 : idx + 1
          if (swapIdx < 0 || swapIdx >= sorted.length) return state
          const reordered = sorted.map((s, i) => {
            if (i === idx) return { ...s, order: swapIdx }
            if (i === swapIdx) return { ...s, order: idx }
            return s
          })
          return { sheets: reordered }
        }),

      reorderSheets: (fromId, toId) =>
        set((state) => {
          if (fromId === toId) return state
          const sorted = [...state.sheets].sort((a, b) => a.order - b.order)
          const fromIdx = sorted.findIndex((s) => s.id === fromId)
          const toIdx = sorted.findIndex((s) => s.id === toId)
          if (fromIdx === -1 || toIdx === -1) return state
          const reordered = [...sorted]
          const removed = reordered.splice(fromIdx, 1)
          const moved = removed[0]
          if (!moved) return state
          reordered.splice(toIdx, 0, moved)
          return {
            sheets: reordered.map((s, i) => ({ ...s, order: i })),
          }
        }),
    }),
    { name: 'workbook-store' }
  )
)
