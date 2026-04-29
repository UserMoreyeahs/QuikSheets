'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CFRule, CFBackupCell } from '../types'
import { applyRulesToSheet, stripRulesFromSheet } from '../utils/cfEvaluator'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { Sheet } from '@fortune-sheet/core'

const STORAGE_KEY_PREFIX = 'quiksheets_cf_rules:'

function loadFromStorage(workbookId: string): Record<string, CFRule[]> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workbookId}`)
    return raw ? (JSON.parse(raw) as Record<string, CFRule[]>) : {}
  } catch {
    return {}
  }
}

function saveToStorage(workbookId: string, rules: Record<string, CFRule[]>): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${workbookId}`, JSON.stringify(rules))
  } catch {
    // localStorage unavailable
  }
}

interface CFState {
  workbookId: string | null
  // rules keyed by sheetId
  rules: Record<string, CFRule[]>
  // backup of original cell styles keyed by sheetId → cellKey → original style
  backup: Record<string, Record<string, CFBackupCell>>
}

interface CFActions {
  loadRules: (workbookId: string) => void
  getRulesForSheet: (sheetId: string) => CFRule[]
  addRule: (sheetId: string, rule: Omit<CFRule, 'id'>) => void
  updateRule: (sheetId: string, id: string, updates: Partial<Omit<CFRule, 'id'>>) => void
  deleteRule: (sheetId: string, id: string) => void
  reorderRules: (sheetId: string, fromIndex: number, toIndex: number) => void
  applyToActiveSheet: () => void
  clearFromSheet: (sheetId: string) => void
}

export const useCFStore = create<CFState & CFActions>()(
  devtools(
    (set, get) => ({
      workbookId: null,
      rules: {},
      backup: {},

      loadRules(workbookId) {
        const stored = loadFromStorage(workbookId)
        set({ workbookId, rules: stored, backup: {} }, false, 'cf/loadRules')
      },

      getRulesForSheet(sheetId) {
        return get().rules[sheetId] ?? []
      },

      addRule(sheetId, rule) {
        const id = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const newRule: CFRule = { ...rule, id }
        set(
          (state) => {
            const sheetRules = [...(state.rules[sheetId] ?? []), newRule]
            const nextRules = { ...state.rules, [sheetId]: sheetRules }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'cf/addRule'
        )
      },

      updateRule(sheetId, id, updates) {
        set(
          (state) => {
            const sheetRules = (state.rules[sheetId] ?? []).map((r) =>
              r.id === id ? { ...r, ...updates } : r
            )
            const nextRules = { ...state.rules, [sheetId]: sheetRules }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'cf/updateRule'
        )
      },

      deleteRule(sheetId, id) {
        const { backup } = get()
        const sheetBackup = backup[sheetId] ?? {}

        // Strip CF styles before removing the rule
        const gridSheets = useSheetStore.getState().gridSheets
        const targetSheet = gridSheets.find((s) => s.id === sheetId)
        if (targetSheet) {
          // Rebuild: strip backup, re-apply remaining rules
          const remainingRules = (get().rules[sheetId] ?? []).filter((r) => r.id !== id)
          const stripped = stripRulesFromSheet(targetSheet, sheetBackup)
          const { sheet: reapplied, backup: newBackup } = applyRulesToSheet(
            stripped,
            remainingRules,
            {}
          )
          const nextSheets = gridSheets.map((s) => (s.id === sheetId ? reapplied : s))
          useSheetStore.getState().replaceGridSheets(nextSheets)
          set(
            (state) => {
              const sheetRules = remainingRules
              const nextRules = { ...state.rules, [sheetId]: sheetRules }
              if (state.workbookId) saveToStorage(state.workbookId, nextRules)
              return {
                rules: nextRules,
                backup: { ...state.backup, [sheetId]: newBackup },
              }
            },
            false,
            'cf/deleteRule'
          )
          return
        }

        set(
          (state) => {
            const sheetRules = (state.rules[sheetId] ?? []).filter((r) => r.id !== id)
            const nextRules = { ...state.rules, [sheetId]: sheetRules }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'cf/deleteRule'
        )
      },

      reorderRules(sheetId, fromIndex, toIndex) {
        set(
          (state) => {
            const sheetRules = [...(state.rules[sheetId] ?? [])]
            const [moved] = sheetRules.splice(fromIndex, 1)
            if (!moved) return {}
            sheetRules.splice(toIndex, 0, moved)
            const reindexed = sheetRules.map((r, i) => ({ ...r, priority: i }))
            const nextRules = { ...state.rules, [sheetId]: reindexed }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'cf/reorderRules'
        )
      },

      applyToActiveSheet() {
        const { activeSheetId } = useWorkbookStore.getState()
        const gridSheets = useSheetStore.getState().gridSheets
        const { rules, backup } = get()

        const sheetRules = rules[activeSheetId] ?? []
        const targetSheet = gridSheets.find((s) => s.id === activeSheetId)
        if (!targetSheet) return

        const sheetBackup = backup[activeSheetId] ?? {}
        const stripped = stripRulesFromSheet(targetSheet, sheetBackup)
        const { sheet: applied, backup: newBackup } = applyRulesToSheet(stripped, sheetRules, {})

        const nextSheets = gridSheets.map((s) => (s.id === activeSheetId ? applied : s))
        useSheetStore.getState().replaceGridSheets(nextSheets)

        set(
          (state) => ({
            backup: { ...state.backup, [activeSheetId]: newBackup },
          }),
          false,
          'cf/applyToActiveSheet'
        )
      },

      clearFromSheet(sheetId) {
        const gridSheets = useSheetStore.getState().gridSheets
        const { backup } = get()

        const targetSheet = gridSheets.find((s) => s.id === sheetId)
        if (targetSheet) {
          const sheetBackup = backup[sheetId] ?? {}
          const stripped = stripRulesFromSheet(targetSheet, sheetBackup)
          const nextSheets = gridSheets.map((s) => (s.id === sheetId ? stripped : s))
          useSheetStore.getState().replaceGridSheets(nextSheets)
        }

        set(
          (state) => {
            const nextRules = { ...state.rules, [sheetId]: [] }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return {
              rules: nextRules,
              backup: { ...state.backup, [sheetId]: {} },
            }
          },
          false,
          'cf/clearFromSheet'
        )
      },
    }),
    { name: 'CFStore' }
  )
)

// Apply CF for all sheets that have rules (called on sheet load)
export function applyAllCFRules(workbookId: string): void {
  useCFStore.getState().loadRules(workbookId)
  const { rules } = useCFStore.getState()
  const gridSheets = useSheetStore.getState().gridSheets

  let changed = false
  const allBackups: Record<string, Record<string, CFBackupCell>> = {}
  const nextSheets: Sheet[] = gridSheets.map((sheet) => {
    const sheetId = typeof sheet.id === 'string' ? sheet.id : ''
    const sheetRules = rules[sheetId] ?? []
    if (sheetRules.length === 0) return sheet

    const { sheet: applied, backup } = applyRulesToSheet(sheet, sheetRules, {})
    allBackups[sheetId] = backup
    changed = true
    return applied
  })

  if (changed) {
    useSheetStore.getState().replaceGridSheets(nextSheets)
    useCFStore.setState({ backup: allBackups })
  }
}
