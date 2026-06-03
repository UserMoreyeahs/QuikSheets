'use client'

/**
 * RowRlsBuilder — modal dialog for creating and managing Row Visibility rules.
 *
 * Mirrors ConditionalFormatting.tsx layout:
 *   - List view shows existing rules with enable/disable toggle, edit, delete.
 *   - Editor view is a multi-step form: name → column → operator → value → scope.
 *   - "Save Rule" persists via useRowRlsStore.addRule / updateRule.
 *
 * Mount trigger: open via `useRowRlsStore().openBuilder()` from any call site
 * (e.g. a ribbon button or a right-click menu item).
 */

import React, { useCallback, useState } from 'react'
import { X, Plus, Trash2, Shield, ShieldCheck, ShieldOff } from 'lucide-react'
import { useRowRlsStore } from '../store/rowRlsStore'
import { useWorkbookStore } from '@/store/workbookStore'
import type {
  RowVisibilityRule,
  RulePredicate,
  RulePredicateOperator,
  RuleScope,
} from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERATOR_LABELS: Record<RulePredicateOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  in: 'is one of (comma-separated)',
  matches_user_id: 'matches current user ID',
  matches_user_email: 'matches current user email',
}

const USER_IDENTITY_OPERATORS: RulePredicateOperator[] = [
  'matches_user_id',
  'matches_user_email',
]

const COLUMN_LETTERS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
)

// ---------------------------------------------------------------------------
// RuleEditor sub-component
// ---------------------------------------------------------------------------

interface RuleEditorProps {
  initialRule: RowVisibilityRule | null
  sheetId: string
  workbookId: string
  onSave: (rule: Omit<RowVisibilityRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

function RuleEditor({ initialRule, sheetId, workbookId, onSave, onCancel }: RuleEditorProps) {
  const [name, setName] = useState(initialRule?.name ?? '')
  const [column, setColumn] = useState(initialRule?.predicate.column ?? 0)
  const [operator, setOperator] = useState<RulePredicateOperator>(
    initialRule?.predicate.operator ?? 'matches_user_email'
  )
  const [rawValue, setRawValue] = useState<string>(() => {
    if (!initialRule) return ''
    const v = initialRule.predicate.value
    if (Array.isArray(v)) return v.join(', ')
    return v ?? ''
  })
  const [scopeKind, setScopeKind] = useState<RuleScope['kind']>(
    initialRule?.scope.kind ?? 'viewers'
  )
  const [specificUserIds, setSpecificUserIds] = useState<string>(
    initialRule?.scope.kind === 'specific_users'
      ? initialRule.scope.userIds.join(', ')
      : ''
  )
  const [specificRoles, setSpecificRoles] = useState<Array<'viewer' | 'editor'>>(() => {
    if (initialRule?.scope.kind === 'specific_roles') return initialRule.scope.roles
    return ['viewer']
  })
  const [nameError, setNameError] = useState('')

  const isIdentityOp = USER_IDENTITY_OPERATORS.includes(operator)

  const buildPredicate = (): RulePredicate => {
    const predicate: RulePredicate = { column, operator }
    if (!isIdentityOp) {
      if (operator === 'in') {
        predicate.value = rawValue
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      } else {
        predicate.value = rawValue
      }
    }
    return predicate
  }

  const buildScope = (): RuleScope => {
    switch (scopeKind) {
      case 'viewers':
        return { kind: 'viewers' }
      case 'editors':
        return { kind: 'editors' }
      case 'specific_users':
        return {
          kind: 'specific_users',
          userIds: specificUserIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
      case 'specific_roles':
        return { kind: 'specific_roles', roles: specificRoles }
      default:
        return { kind: 'viewers' }
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Rule name is required')
      return
    }
    setNameError('')
    onSave({
      workbookId,
      sheetId,
      name: name.trim(),
      predicate: buildPredicate(),
      scope: buildScope(),
      enabled: initialRule?.enabled ?? true,
    })
  }

  const toggleRole = (role: 'viewer' | 'editor') => {
    setSpecificRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step 1: Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Rule name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError('') }}
          placeholder="e.g. Only see your own leads"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {nameError && <span className="text-xs text-red-500">{nameError}</span>}
      </div>

      {/* Step 2: Column + Operator */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Column to check
        </label>
        <div className="flex gap-2">
          <select
            value={column}
            onChange={(e) => setColumn(Number(e.target.value))}
            className="w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {COLUMN_LETTERS.map((letter, idx) => (
              <option key={idx} value={idx}>
                {letter}
              </option>
            ))}
          </select>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as RulePredicateOperator)}
            className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {(Object.keys(OPERATOR_LABELS) as RulePredicateOperator[]).map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 3: Value (hidden for identity operators) */}
      {!isIdentityOp && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {operator === 'in' ? 'Allowed values (comma-separated)' : 'Value'}
          </label>
          <input
            type="text"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            placeholder={operator === 'in' ? 'e.g. Active, Pending, Review' : 'e.g. EMEA'}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      )}

      {isIdentityOp && (
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          The cell value will be compared against the current user&apos;s{' '}
          {operator === 'matches_user_id' ? 'Supabase user ID' : 'email address'} at
          evaluation time. No static value needed.
        </div>
      )}

      {/* Step 4: Scope */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Who does this rule apply to?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['viewers', 'editors', 'specific_roles', 'specific_users'] as const).map(
            (kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setScopeKind(kind)}
                className={[
                  'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                  scopeKind === kind
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400',
                ].join(' ')}
              >
                {kind === 'viewers' && 'All viewers'}
                {kind === 'editors' && 'All editors'}
                {kind === 'specific_roles' && 'Specific roles'}
                {kind === 'specific_users' && 'Specific user IDs'}
              </button>
            )
          )}
        </div>

        {scopeKind === 'specific_roles' && (
          <div className="flex gap-3 pl-1">
            {(['viewer', 'editor'] as const).map((role) => (
              <label
                key={role}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={specificRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="rounded"
                />
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </label>
            ))}
          </div>
        )}

        {scopeKind === 'specific_users' && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={specificUserIds}
              onChange={(e) => setSpecificUserIds(e.target.value)}
              placeholder="Comma-separated Supabase user IDs"
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="text-[11px] text-zinc-400">
              Find user IDs in the Supabase dashboard under Authentication &gt; Users.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save Rule
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Describe rule for list view
// ---------------------------------------------------------------------------

function describeRule(rule: RowVisibilityRule): string {
  const { predicate, scope } = rule
  const colLetter = String.fromCharCode(65 + predicate.column)
  const opLabel = OPERATOR_LABELS[predicate.operator]

  let predicatePart: string
  if (USER_IDENTITY_OPERATORS.includes(predicate.operator)) {
    predicatePart = `Column ${colLetter} ${opLabel}`
  } else if (predicate.operator === 'in' && Array.isArray(predicate.value)) {
    predicatePart = `Column ${colLetter} ${opLabel}: ${predicate.value.join(', ')}`
  } else {
    predicatePart = `Column ${colLetter} ${opLabel} "${String(predicate.value ?? '')}"`
  }

  let scopePart: string
  switch (scope.kind) {
    case 'viewers':
      scopePart = 'all viewers'
      break
    case 'editors':
      scopePart = 'all editors'
      break
    case 'specific_users':
      scopePart = `${scope.userIds.length} user(s)`
      break
    case 'specific_roles':
      scopePart = scope.roles.join(' + ')
      break
    default:
      scopePart = '—'
  }

  return `${predicatePart} → ${scopePart}`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RowRlsBuilderProps {
  isOpen: boolean
  onClose: () => void
}

export function RowRlsBuilder({ isOpen, onClose }: RowRlsBuilderProps) {
  const { activeSheetId } = useWorkbookStore()
  const {
    workbookId,
    getRulesForSheet,
    addRule,
    updateRule,
    deleteRule,
  } = useRowRlsStore()

  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<RowVisibilityRule | null>(null)

  const rules = getRulesForSheet(activeSheetId)
  const effectiveWorkbookId = workbookId ?? ''

  const handleSaveRule = useCallback(
    (ruleData: Omit<RowVisibilityRule, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (editingRule) {
        updateRule(editingRule.id, ruleData)
      } else {
        addRule(ruleData)
      }
      setShowEditor(false)
      setEditingRule(null)
    },
    [editingRule, addRule, updateRule]
  )

  const handleToggleEnabled = useCallback(
    (rule: RowVisibilityRule) => {
      updateRule(rule.id, { enabled: !rule.enabled })
    },
    [updateRule]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[520px] max-w-full flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Row Visibility Rules
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {showEditor ? (
            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="mb-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {editingRule ? 'Edit Rule' : 'New Rule'}
              </h3>
              <RuleEditor
                initialRule={editingRule}
                sheetId={activeSheetId}
                workbookId={effectiveWorkbookId}
                onSave={handleSaveRule}
                onCancel={() => {
                  setShowEditor(false)
                  setEditingRule(null)
                }}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Description banner */}
              <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Row visibility rules hide rows from specific users based on cell values —
                  for example, showing each sales rep only their own leads. Workbook owners
                  always see all rows.
                </p>
              </div>

              {/* Rules list */}
              <div className="flex-1 overflow-y-auto p-4">
                {rules.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <ShieldCheck className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No rules yet for this sheet.
                    </p>
                    <p className="text-xs text-zinc-400">
                      Add a rule to restrict which rows each user can see.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={[
                          'rounded-lg border',
                          rule.enabled
                            ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50'
                            : 'border-zinc-100 bg-white opacity-60 dark:border-zinc-800 dark:bg-zinc-900',
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-2 px-3 py-2.5">
                          {/* Enabled indicator */}
                          <button
                            onClick={() => handleToggleEnabled(rule)}
                            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                            className="mt-0.5 shrink-0"
                          >
                            {rule.enabled ? (
                              <ShieldCheck className="h-4 w-4 text-blue-500" />
                            ) : (
                              <ShieldOff className="h-4 w-4 text-zinc-400" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              {rule.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                              {describeRule(rule)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingRule(rule)
                                setShowEditor(true)
                              }}
                              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteRule(activeSheetId, rule.id)}
                              className="rounded p-0.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                              title="Delete rule"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <button
                  onClick={() => {
                    setEditingRule(null)
                    setShowEditor(true)
                  }}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Add new rule
                </button>
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
