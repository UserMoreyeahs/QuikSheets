'use client'

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
} from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { toCellNotation } from '@/lib/cellAddress'
import { cn } from '@/lib/utils'
import { isValidValue } from '@/lib/validation'
import { FormulaAutocomplete } from '@/features/formula-engine'
import { AICellPrompt, useAIFormula } from '@/features/ai-cell'
import { Sparkles } from 'lucide-react'
import { useLivePreview } from '@/features/live-preview'
import type { FormulaEntry } from '@/features/formula-engine'

function isFormulaNameQuery(value: string): boolean {
  return /^=[A-Za-z][A-Za-z0-9._]*$/.test(value)
}

export function FormulaBar() {
  const {
    selectedCell,
    gridSheets,
    gridInstance,
    formulaBarValue,
    setFormulaBarValue,
    editingCell,
    setEditingCell,
    validationRules,
  } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(formulaBarValue)
  const [isFocused, setIsFocused] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const aiFormula = useAIFormula()
  useLivePreview()

  // Autocomplete triggers when typing =XYZ but not after opening paren
  const shouldShowAutocomplete =
    showAutocomplete &&
    isFocused &&
    isFormulaNameQuery(localValue)

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formulaBarValue)
    }
  }, [formulaBarValue, isFocused])

  useEffect(() => {
    if (aiFormula.formula) {
      setLocalValue(aiFormula.formula)
    }
  }, [aiFormula.formula])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editingCell])

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      const isMac = navigator.platform.includes('Mac')
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

      if (ctrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        gridInstance?.handleUndo()
      }

      if (
        (ctrlOrCmd && e.key === 'y') ||
        (ctrlOrCmd && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault()
        gridInstance?.handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gridInstance])

  const cellLabel = selectedCell
    ? toCellNotation(selectedCell.row, selectedCell.col)
    : ''

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalValue(val)
      setFormulaBarValue(val)
      // Only suggest formulas for function-name queries like `=SUM`.
      setShowAutocomplete(isFormulaNameQuery(val))
    },
    [setFormulaBarValue]
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    if (selectedCell) {
      setEditingCell(selectedCell)
    }
  }, [selectedCell, setEditingCell])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    setEditingCell(null)
    // Delay hide so onMouseDown on autocomplete item fires first
    setTimeout(() => setShowAutocomplete(false), 150)
  }, [setEditingCell])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setShowAutocomplete(false)
        setLocalValue(formulaBarValue)
        setIsFocused(false)
        setEditingCell(null)
        inputRef.current?.blur()
      }

      if (e.key === 'Enter' && !shouldShowAutocomplete) {
        if (selectedCell && gridInstance) {
          const validationKey = `${activeSheetId}:${selectedCell.row}:${selectedCell.col}`
          const validation = validationRules[validationKey]

          if (
            !isValidValue(localValue, validation, {
              sheets: gridSheets,
              sheetIndex: selectedCell.sheet,
              row: selectedCell.row,
              col: selectedCell.col,
            })
          ) {
            window.alert(validation?.errorMessage || 'The value does not match the validation rule.')
            return
          }

          gridInstance.setCellValue(selectedCell.row, selectedCell.col, localValue, {
            id: activeSheetId,
          })
        }
        setFormulaBarValue(localValue)
        setIsFocused(false)
        setEditingCell(null)
        inputRef.current?.blur()
      }
    },
    [
      activeSheetId,
      formulaBarValue,
      gridSheets,
      gridInstance,
      localValue,
      selectedCell,
      setFormulaBarValue,
      setEditingCell,
      shouldShowAutocomplete,
      validationRules,
    ]
  )

  const handleAutocompleteSelect = useCallback(
    (entry: FormulaEntry) => {
      const val = `=${entry.name}(`
      setLocalValue(val)
      setFormulaBarValue(val)
      setShowAutocomplete(false)
      inputRef.current?.focus()
    },
    [setFormulaBarValue]
  )

  const handleAutocompleteClose = useCallback(() => {
    setShowAutocomplete(false)
  }, [])

  const handleAiFormulaClick = useCallback(() => {
    const trigger = '=?'
    setLocalValue(trigger)
    setFormulaBarValue(trigger)
    setShowAutocomplete(false)
    setIsFocused(true)
    if (selectedCell) {
      setEditingCell(selectedCell)
    }
    inputRef.current?.focus()
  }, [selectedCell, setEditingCell, setFormulaBarValue])

  const canUndo = Boolean(gridInstance)
  const canRedo = Boolean(gridInstance)

  return (
    <div className="relative flex h-9 w-full shrink-0 items-center border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      {/* Cell Address Box */}
      <div className="flex h-full w-[100px] shrink-0 items-center justify-center border-r border-zinc-200 bg-zinc-50 px-2 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="select-none font-mono text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {cellLabel || 'A1'}
        </span>
      </div>

      {/* Function Icon */}
      <div className="flex h-full w-8 shrink-0 items-center justify-center border-r border-zinc-200 dark:border-zinc-700">
        <span className="select-none text-xs font-medium italic text-zinc-400 dark:text-zinc-500">
          fx
        </span>
      </div>

      {/* Formula Input */}
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Enter value or formula..."
        className={cn(
          'h-full flex-1 bg-white px-3 font-mono text-sm',
          'text-zinc-800 outline-none placeholder:text-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600',
          'transition-colors duration-100',
          isFocused && 'bg-blue-50 dark:bg-blue-500/10'
        )}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Autocomplete dropdown */}
      {shouldShowAutocomplete && (
        <FormulaAutocomplete
          query={localValue}
          anchorRef={inputRef as React.RefObject<HTMLElement>}
          onSelect={handleAutocompleteSelect}
          onClose={handleAutocompleteClose}
        />
      )}

      {aiFormula.isOpen && (
        <AICellPrompt
          cellAddress={aiFormula.cellAddress}
          selectedCell={aiFormula.selectedCell}
          isLoading={aiFormula.isLoading}
          error={aiFormula.error}
          formula={aiFormula.formula}
          explanation={aiFormula.explanation}
          onGenerate={aiFormula.generate}
          onAccept={aiFormula.accept}
          onCancel={() => {
            aiFormula.cancel()
            setLocalValue('')
          }}
        />
      )}

      {/* Divider */}
      <div className="mx-1 h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />

      <button
        type="button"
        onClick={handleAiFormulaClick}
        title="AI formula (type =?)"
        className={cn(
          'mr-1 flex h-7 w-7 items-center justify-center rounded',
          'text-blue-500 transition-colors duration-100',
          'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-300'
        )}
      >
        <Sparkles size={14} />
      </button>

      {/* Undo Button */}
      <button
        onClick={() => gridInstance?.handleUndo()}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded',
          'text-zinc-400 transition-colors duration-100 mr-1',
          canUndo
            ? 'hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            : 'opacity-30 cursor-not-allowed'
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>

      {/* Redo Button */}
      <button
        onClick={() => gridInstance?.handleRedo()}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded',
          'text-zinc-400 transition-colors duration-100 mr-2',
          canRedo
            ? 'hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            : 'opacity-30 cursor-not-allowed'
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>
    </div>
  )
}
