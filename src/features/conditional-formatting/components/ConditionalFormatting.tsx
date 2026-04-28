'use client'

import React, { useCallback, useState } from 'react'
import { X, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { useCFStore } from '../store/cfStore'
import { validateRange } from '../utils/cfEvaluator'
import { useWorkbookStore } from '@/store/workbookStore'
import type { CFRule, CFCondition, CFConditionType, CFFormat, CFOperator } from '../types'

interface ConditionalFormattingProps {
  isOpen: boolean
  onClose: () => void
}

const CONDITION_LABELS: Record<CFConditionType, string> = {
  cell_value: 'Cell value is',
  text_contains: 'Text',
  cell_empty: 'Cell is empty',
  cell_not_empty: 'Cell is not empty',
  duplicate_values: 'Duplicate values',
  unique_values: 'Unique values',
  top_n: 'Top N items',
  bottom_n: 'Bottom N items',
  above_average: 'Above average',
  below_average: 'Below average',
  custom_formula: 'Custom formula',
}

const OPERATOR_LABELS: Record<CFOperator, string> = {
  equal: 'equal to',
  not_equal: 'not equal to',
  greater: 'greater than',
  greater_equal: 'greater than or equal to',
  less: 'less than',
  less_equal: 'less than or equal to',
  between: 'between',
  not_between: 'not between',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
}

const VALUE_OPERATORS: CFOperator[] = [
  'equal', 'not_equal', 'greater', 'greater_equal', 'less', 'less_equal', 'between', 'not_between',
]
const TEXT_OPERATORS: CFOperator[] = ['contains', 'not_contains', 'starts_with', 'ends_with']

function defaultCondition(type: CFConditionType): CFCondition {
  switch (type) {
    case 'cell_value':
      return { type, operator: 'greater', value: '0' }
    case 'text_contains':
      return { type, operator: 'contains', value: '' }
    case 'top_n':
    case 'bottom_n':
      return { type, n: 10 }
    default:
      return { type }
  }
}

function describeRule(rule: CFRule): string {
  const { condition } = rule
  switch (condition.type) {
    case 'cell_value':
      return `Value ${OPERATOR_LABELS[condition.operator ?? 'equal']} ${condition.value ?? ''}${condition.operator === 'between' || condition.operator === 'not_between' ? ` and ${condition.value2 ?? ''}` : ''}`
    case 'text_contains':
      return `Text ${OPERATOR_LABELS[condition.operator ?? 'contains']} "${condition.value ?? ''}"`
    case 'top_n':
      return `Top ${condition.n ?? 10} items`
    case 'bottom_n':
      return `Bottom ${condition.n ?? 10} items`
    default:
      return CONDITION_LABELS[condition.type]
  }
}

interface RuleEditorProps {
  initialRule: CFRule | undefined
  onSave: (rule: Omit<CFRule, 'id'>) => void
  onCancel: () => void
}

function ColorInput({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-16 text-xs text-zinc-600 dark:text-zinc-400">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-zinc-300 p-0.5 dark:border-zinc-600"
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          title="Clear"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function RuleEditor({ initialRule, onSave, onCancel }: RuleEditorProps) {
  const defaultRange = 'A1:Z100'
  const [range, setRange] = useState(initialRule?.range ?? defaultRange)
  const [condType, setCondType] = useState<CFConditionType>(initialRule?.condition.type ?? 'cell_value')
  const [operator, setOperator] = useState<CFOperator>(initialRule?.condition.operator ?? 'greater')
  const [value, setValue] = useState(initialRule?.condition.value ?? '0')
  const [value2, setValue2] = useState(initialRule?.condition.value2 ?? '')
  const [nVal, setNVal] = useState(String(initialRule?.condition.n ?? 10))
  const [format, setFormat] = useState<CFFormat>(initialRule?.format ?? { fill: '#DBEAFE', bold: false, italic: false })
  const [rangeError, setRangeError] = useState('')

  const handleCondTypeChange = (type: CFConditionType) => {
    setCondType(type)
    const defaults = defaultCondition(type)
    setOperator(defaults.operator ?? 'equal')
    setValue(defaults.value ?? '')
    setValue2('')
    setNVal(String(defaults.n ?? 10))
  }

  const handleSave = () => {
    if (!validateRange(range)) {
      setRangeError('Invalid range format (e.g., A1:F100)')
      return
    }
    const condition: CFCondition = { type: condType }
    if (condType === 'cell_value' || condType === 'text_contains') {
      condition.operator = operator
      condition.value = value
      if (operator === 'between' || operator === 'not_between') condition.value2 = value2
    }
    if (condType === 'top_n' || condType === 'bottom_n') condition.n = parseInt(nVal) || 10
    onSave({ range, condition, format, priority: initialRule?.priority ?? Date.now() })
  }

  const operators = condType === 'text_contains' ? TEXT_OPERATORS : VALUE_OPERATORS

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Applied range</label>
        <input
          type="text"
          value={range}
          onChange={(e) => { setRange(e.target.value); setRangeError('') }}
          placeholder="e.g. A1:F100"
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {rangeError && <span className="text-xs text-red-500">{rangeError}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Format cells if…</label>
        <select
          value={condType}
          onChange={(e) => handleCondTypeChange(e.target.value as CFConditionType)}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {(Object.keys(CONDITION_LABELS) as CFConditionType[]).map((type) => (
            <option key={type} value={type}>{CONDITION_LABELS[type]}</option>
          ))}
        </select>
      </div>

      {(condType === 'cell_value' || condType === 'text_contains') && (
        <div className="flex flex-col gap-2">
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as CFOperator)}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {operators.map((op) => (
              <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={condType === 'text_contains' ? 'Text value' : 'Value'}
              className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {(operator === 'between' || operator === 'not_between') && (
              <input
                type="text"
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                placeholder="and"
                className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            )}
          </div>
        </div>
      )}

      {(condType === 'top_n' || condType === 'bottom_n') && (
        <input
          type="number"
          min="1"
          value={nVal}
          onChange={(e) => setNVal(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Formatting</p>
        <ColorInput
          label="Fill"
          value={format.fill}
          onChange={(v) => setFormat((f) => ({ ...f, ...(v !== undefined ? { fill: v } : {}) }))}
        />
        <ColorInput
          label="Text"
          value={format.color}
          onChange={(v) => setFormat((f) => ({ ...f, ...(v !== undefined ? { color: v } : {}) }))}
        />
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={format.bold ?? false}
              onChange={(e) => setFormat((f) => ({ ...f, bold: e.target.checked }))}
              className="rounded"
            />
            Bold
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={format.italic ?? false}
              onChange={(e) => setFormat((f) => ({ ...f, italic: e.target.checked }))}
              className="rounded"
            />
            Italic
          </label>
        </div>
        {/* Preview */}
        <div
          className="mt-1 rounded px-3 py-1.5 text-sm"
          style={{
            backgroundColor: format.fill ?? 'transparent',
            color: format.color ?? 'inherit',
            fontWeight: format.bold ? 'bold' : 'normal',
            fontStyle: format.italic ? 'italic' : 'normal',
            border: '1px solid #e5e7eb',
          }}
        >
          Preview text
        </div>
      </div>

      <div className="flex justify-end gap-2">
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

export function ConditionalFormatting({ isOpen, onClose }: ConditionalFormattingProps) {
  const { activeSheetId } = useWorkbookStore()
  const { getRulesForSheet, addRule, updateRule, deleteRule, reorderRules, applyToActiveSheet, clearFromSheet } =
    useCFStore()

  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<CFRule | null>(null)

  const rules = getRulesForSheet(activeSheetId)

  const handleSaveRule = useCallback(
    (ruleData: Omit<CFRule, 'id'>) => {
      if (editingRule) {
        updateRule(activeSheetId, editingRule.id, ruleData)
      } else {
        addRule(activeSheetId, ruleData)
      }
      setShowEditor(false)
      setEditingRule(null)
    },
    [activeSheetId, editingRule, addRule, updateRule]
  )

  const handleApply = useCallback(() => {
    applyToActiveSheet()
    onClose()
  }, [applyToActiveSheet, onClose])

  const handleClearAll = useCallback(() => {
    if (window.confirm('Clear all conditional formatting rules for this sheet?')) {
      clearFromSheet(activeSheetId)
    }
  }, [activeSheetId, clearFromSheet])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[500px] max-w-full flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Conditional Formatting</h2>
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
                initialRule={editingRule ?? undefined}
                onSave={handleSaveRule}
                onCancel={() => { setShowEditor(false); setEditingRule(null) }}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Rules list */}
              <div className="flex-1 overflow-y-auto p-4">
                {rules.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No rules yet for this sheet.</p>
                    <p className="text-xs text-zinc-400">Add a rule to highlight cells based on their values.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {rules.map((rule, index) => (
                      <div
                        key={rule.id}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-zinc-400" />

                          {/* Color swatch */}
                          <div
                            className="h-5 w-5 shrink-0 rounded border border-zinc-300"
                            style={{
                              backgroundColor: rule.format.fill ?? 'transparent',
                              borderColor: rule.format.color ?? undefined,
                            }}
                          />

                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs text-zinc-700 dark:text-zinc-300">
                              {describeRule(rule)}
                            </p>
                            <p className="text-[11px] text-zinc-400">{rule.range}</p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => reorderRules(activeSheetId, index, Math.max(0, index - 1))}
                              disabled={index === 0}
                              className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 dark:hover:text-zinc-300"
                              title="Move up"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => reorderRules(activeSheetId, index, Math.min(rules.length - 1, index + 1))}
                              disabled={index === rules.length - 1}
                              className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 dark:hover:text-zinc-300"
                              title="Move down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => { setEditingRule(rule); setShowEditor(true) }}
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

              {/* Footer buttons */}
              <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <button
                  onClick={() => { setEditingRule(null); setShowEditor(true) }}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
                >
                  <Plus className="h-3.5 w-3.5" /> Add new rule
                </button>

                <div className="flex justify-between gap-2">
                  {rules.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      Clear all
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={onClose}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApply}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
