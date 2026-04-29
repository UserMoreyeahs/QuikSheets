'use client'

import React, { useEffect, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toCellNotation } from '@/lib/cellAddress'
import type { ValidationRule } from '@/types/sheet.types'

interface DataValidationProps {
  isOpen: boolean
  onClose: () => void
}

type RuleType = 'any' | 'number' | 'text' | 'list' | 'date' | 'email' | 'url' | 'custom'

const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: 'any', label: 'Any value' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text length' },
  { value: 'list', label: 'List (dropdown)' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email address' },
  { value: 'url', label: 'URL' },
  { value: 'custom', label: 'Custom formula' },
]

export function DataValidation({ isOpen, onClose }: DataValidationProps) {
  const { selectedCell, setValidationRule } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()

  const [ruleType, setRuleType] = useState<RuleType>('any')
  const [minValue, setMinValue] = useState('')
  const [maxValue, setMaxValue] = useState('')
  const [listItems, setListItems] = useState('')
  const [customFormula, setCustomFormula] = useState('')
  const [errorMessage, setErrorMessage] = useState('Invalid input')
  const [showDropdown, setShowDropdown] = useState(true)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const cellLabel = selectedCell ? toCellNotation(selectedCell.row, selectedCell.col) : 'A1'
  const showMinMax = ruleType === 'number' || ruleType === 'text' || ruleType === 'date'

  function buildRule(): ValidationRule {
    switch (ruleType) {
      case 'number':
        return {
          type: 'number',
          ...(minValue ? { min: Number(minValue) } : {}),
          ...(maxValue ? { max: Number(maxValue) } : {}),
        }
      case 'text':
        return {
          type: 'text',
          ...(minValue ? { minLength: Number(minValue) } : {}),
          ...(maxValue ? { maxLength: Number(maxValue) } : {}),
        }
      case 'list':
        return {
          type: 'list',
          options: listItems.split('\n').map((item) => item.trim()).filter(Boolean),
        }
      case 'date':
        return {
          type: 'date',
          ...(minValue ? { min: minValue } : {}),
          ...(maxValue ? { max: maxValue } : {}),
        }
      case 'email':
        return { type: 'email' }
      case 'url':
        return { type: 'url' }
      case 'custom':
        return { type: 'custom', formula: customFormula }
      default:
        return { type: 'any' }
    }
  }

  function handleApply() {
    if (!selectedCell) return

    const key = `${activeSheetId}:${selectedCell.row}:${selectedCell.col}`
    setValidationRule(key, { rule: buildRule(), errorMessage, showDropdown })
    onClose()
  }

  function handleRemove() {
    if (!selectedCell) return

    const key = `${activeSheetId}:${selectedCell.row}:${selectedCell.col}`
    setValidationRule(key, null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-[400px] rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Data Validation</h2>
            <p className="text-xs text-zinc-400">Cell {cellLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-zinc-600">
            x
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Criteria</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-blue-400"
            >
              {RULE_TYPES.map((rule) => (
                <option key={rule.value} value={rule.value}>
                  {rule.label}
                </option>
              ))}
            </select>
          </div>

          {showMinMax && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-500">Min</label>
                <input
                  type="text"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  placeholder="Min value"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-500">Max</label>
                <input
                  type="text"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  placeholder="Max value"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>
          )}

          {ruleType === 'list' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">Options (one per line)</label>
              <textarea
                value={listItems}
                onChange={(e) => setListItems(e.target.value)}
                placeholder={'Active\nInactive\nPending'}
                rows={4}
                className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={showDropdown}
                  onChange={(e) => setShowDropdown(e.target.checked)}
                />
                Show dropdown in cell
              </label>
            </div>
          )}

          {ruleType === 'custom' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">Custom formula</label>
              <input
                type="text"
                value={customFormula}
                onChange={(e) => setCustomFormula(e.target.value)}
                placeholder="=AND(A1>0, A1<100)"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}

          {ruleType !== 'any' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">Error message</label>
              <input
                type="text"
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-500 transition-colors hover:text-red-700"
          >
            Remove validation
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs text-white hover:bg-zinc-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
