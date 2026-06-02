'use client'

/**
 * Row RLS Zustand Store
 *
 * Manages RowVisibilityRule records for the current workbook.
 * Mirrors cfStore.ts architecture: Supabase-first with localStorage fallback,
 * in-memory rule list, and open/close state for the builder modal.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { RowVisibilityRule } from '../types'
import {
  loadRules as apiLoadRules,
  saveRule as apiSaveRule,
  updateRule as apiUpdateRule,
  deleteRule as apiDeleteRule,
} from '@/lib/rowRlsApi'

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface RowRlsState {
  /** Active workbook ID; null until loadRules is called. */
  workbookId: string | null
  /**
   * All rules for the workbook, keyed by sheetId.
   * `{ [sheetId]: RowVisibilityRule[] }`
   */
  rules: Record<string, RowVisibilityRule[]>
  /** Whether the builder modal is open. */
  builderOpen: boolean
  /** Rule currently being edited in the builder (null = new rule). */
  activeRule: RowVisibilityRule | null
}

interface RowRlsActions {
  /** Load all rules for a workbook from Supabase / localStorage. */
  loadRules: (workbookId: string) => Promise<void>
  /** Return rules for the given sheet (empty array when none). */
  getRulesForSheet: (sheetId: string) => RowVisibilityRule[]
  /** Add a new rule. Persists in background. */
  addRule: (rule: Omit<RowVisibilityRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** Update an existing rule by ID. Persists in background. */
  updateRule: (id: string, updates: Partial<Omit<RowVisibilityRule, 'id'>>) => void
  /** Delete a rule by ID. Persists in background. */
  deleteRule: (sheetId: string, id: string) => void
  /** Open the builder modal. Pass a rule to edit it; omit to create new. */
  openBuilder: (rule?: RowVisibilityRule) => void
  /** Close the builder modal. */
  closeBuilder: () => void
  /** Set the activeRule (used internally by the builder). */
  setActive: (rule: RowVisibilityRule | null) => void
}

// ---------------------------------------------------------------------------
// localStorage write-through helper
// ---------------------------------------------------------------------------

function saveToStorage(workbookId: string, rules: Record<string, RowVisibilityRule[]>): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`quiksheets_row_rls:${workbookId}`, JSON.stringify(rules))
    }
  } catch {
    // quota / private mode — silently skip
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRowRlsStore = create<RowRlsState & RowRlsActions>()(
  devtools(
    (set, get) => ({
      workbookId: null,
      rules: {},
      builderOpen: false,
      activeRule: null,

      async loadRules(workbookId) {
        const stored = await apiLoadRules(workbookId)
        set({ workbookId, rules: stored }, false, 'rowRls/loadRules')
      },

      getRulesForSheet(sheetId) {
        return get().rules[sheetId] ?? []
      },

      addRule(ruleData) {
        const id = `rrl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const now = new Date().toISOString()
        const newRule: RowVisibilityRule = {
          ...ruleData,
          id,
          createdAt: now,
          updatedAt: now,
        }
        const { sheetId } = ruleData
        set(
          (state) => {
            const sheetRules = [...(state.rules[sheetId] ?? []), newRule]
            const nextRules = { ...state.rules, [sheetId]: sheetRules }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'rowRls/addRule'
        )
        const { workbookId } = get()
        if (workbookId) void apiSaveRule(workbookId, sheetId, newRule)
      },

      updateRule(id, updates) {
        let updatedRule: RowVisibilityRule | undefined
        const now = new Date().toISOString()
        set(
          (state) => {
            const nextRules: Record<string, RowVisibilityRule[]> = {}
            for (const [sheetId, sheetRules] of Object.entries(state.rules)) {
              nextRules[sheetId] = sheetRules.map((r) => {
                if (r.id !== id) return r
                const next: RowVisibilityRule = { ...r, ...updates, id, updatedAt: now }
                updatedRule = next
                return next
              })
            }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'rowRls/updateRule'
        )
        const { workbookId } = get()
        if (workbookId && updatedRule) {
          void apiUpdateRule(workbookId, updatedRule.sheetId, updatedRule)
        }
      },

      deleteRule(sheetId, id) {
        set(
          (state) => {
            const sheetRules = (state.rules[sheetId] ?? []).filter((r) => r.id !== id)
            const nextRules = { ...state.rules, [sheetId]: sheetRules }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'rowRls/deleteRule'
        )
        const { workbookId } = get()
        if (workbookId) void apiDeleteRule(workbookId, sheetId, id)
      },

      openBuilder(rule) {
        set({ builderOpen: true, activeRule: rule ?? null }, false, 'rowRls/openBuilder')
      },

      closeBuilder() {
        set({ builderOpen: false, activeRule: null }, false, 'rowRls/closeBuilder')
      },

      setActive(rule) {
        set({ activeRule: rule }, false, 'rowRls/setActive')
      },
    }),
    { name: 'RowRlsStore' }
  )
)
