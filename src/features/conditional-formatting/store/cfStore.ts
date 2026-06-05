'use client'

/**
 * Conditional Formatting Zustand Store
 *
 * Manages CF rules for all sheets in a workbook and applies/removes style
 * patches to the FortuneSheet grid data via `sheetStore.replaceGridSheets`.
 *
 * Persistence:
 *   Rules are stored in Supabase via cfRulesApi (primary) with a
 *   localStorage fallback for unauthenticated / offline use.
 *   Backups (original cell styles before CF overrides) are held in memory
 *   only and rebuilt on each page load.
 *
 * Workflow:
 *   loadRules(workbookId)    — Called once on sheet page mount (async, Supabase-first).
 *   addRule / updateRule     — Mutate rules; call applyToActiveSheet afterwards.
 *   deleteRule               — Strips CF styles, re-applies remaining rules, saves.
 *   reorderRules             — Drag-to-reorder (priority index = array position).
 *   applyToActiveSheet       — Strips backup, re-evaluates rules, patches gridSheets.
 *   clearFromSheet           — Removes all rules + styles for a sheet.
 *   quickAddRule             — addRule + applyToActiveSheet in one call.
 *   applyAllCFRules          — Top-level function called on page load (all sheets).
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CFRule, CFBackupCell } from '../types'
import { applyRulesToSheet, stripRulesFromSheet } from '../utils/cfEvaluator'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type { Sheet } from '@fortune-sheet/core'
import {
  loadRules as apiLoadRules,
  saveRule as apiSaveRule,
  updateRule as apiUpdateRule,
  deleteRule as apiDeleteRule,
  deleteAllRulesForSheet as apiDeleteAllRulesForSheet,
} from '@/lib/cfRulesApi'

// ---------------------------------------------------------------------------
// localStorage write-through (keeps cfRulesApi's local cache in sync when
// the store mutates rules in-memory synchronously before the async API call
// resolves). cfRulesApi also writes localStorage internally on every
// saveRule / updateRule / deleteRule call, so this is belt-and-suspenders.
// ---------------------------------------------------------------------------

/** @deprecated — kept only as the in-memory sync-to-local fallback for the rule list. */
function saveToStorage(workbookId: string, rules: Record<string, CFRule[]>): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`quiksheets_cf_rules:${workbookId}`, JSON.stringify(rules))
    }
  } catch {
    // localStorage unavailable
  }
}

interface CFState {
  /** Active workbook ID; null until `loadRules` is called. */
  workbookId: string | null
  /** CF rules for each sheet: `{ [sheetId]: CFRule[] }`. */
  rules: Record<string, CFRule[]>
  /**
   * Per-sheet backup of original cell styles before CF was applied.
   * Shape: `{ [sheetId]: { [rowColKey]: CFBackupCell } }`.
   * Held in memory only — rebuilt from storage on each page load.
   */
  backup: Record<string, Record<string, CFBackupCell>>
}

interface CFActions {
  loadRules: (workbookId: string) => Promise<void>
  getRulesForSheet: (sheetId: string) => CFRule[]
  addRule: (sheetId: string, rule: Omit<CFRule, 'id'>) => void
  updateRule: (sheetId: string, id: string, updates: Partial<Omit<CFRule, 'id'>>) => void
  deleteRule: (sheetId: string, id: string) => void
  reorderRules: (sheetId: string, fromIndex: number, toIndex: number) => void
  applyToActiveSheet: () => void
  clearFromSheet: (sheetId: string) => void
  quickAddRule: (sheetId: string, rule: Omit<CFRule, 'id'>) => void
  clearRulesFromSelection: (sheetId: string, rangeStr: string) => void
}

export const useCFStore = create<CFState & CFActions>()(
  devtools(
    (set, get) => ({
      workbookId: null,
      rules: {},
      backup: {},

      async loadRules(workbookId) {
        // Load from Supabase (or localStorage fallback).
        const stored = await apiLoadRules(workbookId)
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
            // Sync to localStorage immediately (in-memory fast path).
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'cf/addRule'
        )
        // Persist to Supabase in the background.
        const { workbookId: wbId } = get()
        if (wbId) {
          void apiSaveRule(wbId, sheetId, newRule)
        }
      },

      updateRule(sheetId, id, updates) {
        let updatedRule: CFRule | undefined
        set(
          (state) => {
            const sheetRules = (state.rules[sheetId] ?? []).map((r) => {
              if (r.id !== id) return r
              const next = { ...r, ...updates }
              updatedRule = next
              return next
            })
            const nextRules = { ...state.rules, [sheetId]: sheetRules }
            if (state.workbookId) saveToStorage(state.workbookId, nextRules)
            return { rules: nextRules }
          },
          false,
          'cf/updateRule'
        )
        const { workbookId: wbId } = get()
        if (wbId && updatedRule) {
          void apiUpdateRule(wbId, sheetId, updatedRule)
        }
      },

      deleteRule(sheetId, id) {
        const { backup, workbookId: wbId } = get()
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
              const nextRules = { ...state.rules, [sheetId]: remainingRules }
              if (state.workbookId) saveToStorage(state.workbookId, nextRules)
              return {
                rules: nextRules,
                backup: { ...state.backup, [sheetId]: newBackup },
              }
            },
            false,
            'cf/deleteRule'
          )
          if (wbId) void apiDeleteRule(wbId, sheetId, id)
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
        if (wbId) void apiDeleteRule(wbId, sheetId, id)
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
            // Persist each reordered rule to Supabase.
            if (state.workbookId) {
              const wbId = state.workbookId
              for (const r of reindexed) {
                void apiUpdateRule(wbId, sheetId, r)
              }
            }
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
        const { backup, workbookId: wbId } = get()

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
        if (wbId) void apiDeleteAllRulesForSheet(wbId, sheetId)
      },

      quickAddRule(sheetId, rule) {
        get().addRule(sheetId, rule)
        get().applyToActiveSheet()
      },

      clearRulesFromSelection(sheetId, rangeStr) {
        // Delete only the rules whose A1 range overlaps the given selection,
        // so "Clear Rules from Selected Cells" no longer wipes the whole sheet.
        const parseA1 = (
          a1: string,
        ): { sr: number; sc: number; er: number; ec: number } | null => {
          const cell = (s: string): { r: number; c: number } | null => {
            const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(s.trim())
            if (!m) return null
            const letters = (m[1] ?? '').toUpperCase()
            let col = 0
            for (let i = 0; i < letters.length; i += 1) {
              col = col * 26 + (letters.charCodeAt(i) - 64)
            }
            return { r: parseInt(m[2] ?? '1', 10) - 1, c: col - 1 }
          }
          const parts = (a1 ?? '').split(':')
          const a = cell(parts[0] ?? '')
          const b = parts[1] !== undefined ? cell(parts[1]) : a
          if (!a || !b) return null
          return {
            sr: Math.min(a.r, b.r),
            sc: Math.min(a.c, b.c),
            er: Math.max(a.r, b.r),
            ec: Math.max(a.c, b.c),
          }
        }

        const sel = parseA1(rangeStr)
        const rules = get().rules[sheetId] ?? []
        if (!sel || rules.length === 0) return

        const ids = rules
          .filter((rule) => {
            const rr = parseA1(rule.range)
            // Two rectangles intersect when neither lies fully to one side.
            return rr
              ? rr.sr <= sel.er && sel.sr <= rr.er && rr.sc <= sel.ec && sel.sc <= rr.ec
              : false
          })
          .map((rule) => rule.id)

        // deleteRule strips that rule's CF styles, re-applies the remaining
        // rules, and persists — so this behaves like deleting them one by one.
        ids.forEach((id) => get().deleteRule(sheetId, id))
      },
    }),
    { name: 'CFStore' }
  )
)

/**
 * Apply CF rules for ALL sheets in the workbook at once.
 *
 * Called once from the sheet page's `useEffect` (with a 500ms delay to allow
 * the FortuneSheet grid to hydrate) so that saved rules are visible immediately
 * when a workbook is opened.
 *
 * This is an async function because `loadRules` now fetches from Supabase.
 *
 * @param workbookId - The current workbook's UUID (or "demo").
 */
export async function applyAllCFRules(workbookId: string): Promise<void> {
  await useCFStore.getState().loadRules(workbookId)
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
