'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { useCFStore } from '../store/cfStore'
import { CFInlineDialog } from './CFInlineDialog'
import {
  DATA_BAR_PRESETS,
  COLOR_SCALE_PRESETS,
  ICON_SET_PRESETS,
} from '../constants/presets'
import type { CFConditionType, CFDatePeriod, CFFormat, CFOperator } from '../types'

// ─── Selection-to-range helper ─────────────────────────────────────────────

function selectionToRange(
  selectedCell: { row: number; col: number } | null,
  selectedRange: { start: { row: number; col: number }; end: { row: number; col: number } } | null
): string {
  if (!selectedCell) return 'A1:Z100'
  const toCol = (c: number) => {
    let s = ''
    let n = c + 1
    while (n > 0) {
      const r = (n - 1) % 26
      s = String.fromCharCode(65 + r) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }
  if (!selectedRange) return `${toCol(selectedCell.col)}${selectedCell.row + 1}`
  const sr = Math.min(selectedRange.start.row, selectedRange.end.row)
  const er = Math.max(selectedRange.start.row, selectedRange.end.row)
  const sc = Math.min(selectedRange.start.col, selectedRange.end.col)
  const ec = Math.max(selectedRange.start.col, selectedRange.end.col)
  return `${toCol(sc)}${sr + 1}:${toCol(ec)}${er + 1}`
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ActiveSubmenu =
  | 'highlight'
  | 'topBottom'
  | 'dataBars'
  | 'colorScales'
  | 'iconSets'
  | 'clearRules'
  | null

type InlineDialogConfig = {
  title: string
  type: 'value' | 'between' | 'text' | 'date' | 'topN' | 'topNPercent'
  conditionType: CFConditionType
  operator?: CFOperator
} | null

interface CFDropdownMenuProps {
  onOpenManageRules: () => void
}

// ─── Icon set category grouping helper ──────────────────────────────────────

const ICON_CATEGORIES = ['Directional', 'Shapes', 'Indicators', 'Ratings'] as const

// ─── Component ──────────────────────────────────────────────────────────────

export function CFDropdownMenu({ onOpenManageRules }: CFDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<ActiveSubmenu>(null)
  const [inlineDialog, setInlineDialog] = useState<InlineDialogConfig>(null)

  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const submenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { selectedCell, selectedRange } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const { addRule, applyToActiveSheet, clearFromSheet } = useCFStore()

  // Quick add: addRule + applyToActiveSheet
  const quickAddRule = useCallback(
    (rule: Parameters<typeof addRule>[1]) => {
      addRule(activeSheetId, rule)
      // Defer apply so the rule is committed to store first
      setTimeout(() => applyToActiveSheet(), 0)
    },
    [activeSheetId, addRule, applyToActiveSheet]
  )

  const range = selectionToRange(selectedCell, selectedRange)

  // ── Close on outside click ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setActiveSubmenu(null)
        setInlineDialog(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // ── Submenu hover management ────────────────────────────────────────────
  const openSubmenu = useCallback((sub: ActiveSubmenu) => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current)
    setInlineDialog(null)
    submenuTimerRef.current = setTimeout(() => setActiveSubmenu(sub), 100)
  }, [])

  const closeSubmenu = useCallback(() => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current)
    submenuTimerRef.current = setTimeout(() => setActiveSubmenu(null), 100)
  }, [])

  const keepSubmenu = useCallback(() => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current)
  }, [])

  // ── Close menu helper ───────────────────────────────────────────────────
  const closeAll = useCallback(() => {
    setIsOpen(false)
    setActiveSubmenu(null)
    setInlineDialog(null)
  }, [])

  // ── Inline dialog apply handler ─────────────────────────────────────────
  const handleInlineApply = useCallback(
    (config: NonNullable<InlineDialogConfig>) =>
      (params: { value?: string; value2?: string; n?: number; datePeriod?: CFDatePeriod; format: CFFormat }) => {
        quickAddRule({
          range,
          condition: {
            type: config.conditionType,
            ...(config.operator !== undefined ? { operator: config.operator } : {}),
            ...(params.value !== undefined ? { value: params.value } : {}),
            ...(params.value2 !== undefined ? { value2: params.value2 } : {}),
            ...(params.n !== undefined ? { n: params.n } : {}),
            ...(params.datePeriod !== undefined ? { datePeriod: params.datePeriod } : {}),
          },
          format: params.format,
          priority: Date.now(),
        })
        closeAll()
      },
    [quickAddRule, range, closeAll]
  )

  // ── Apply immediate rule (no dialog) ────────────────────────────────────
  const applyImmediate = useCallback(
    (conditionType: CFConditionType, format: CFFormat) => {
      quickAddRule({
        range,
        condition: { type: conditionType },
        format,
        priority: Date.now(),
      })
      closeAll()
    },
    [quickAddRule, range, closeAll]
  )

  // ── Data bar click ──────────────────────────────────────────────────────
  const applyDataBar = useCallback(
    (preset: (typeof DATA_BAR_PRESETS)[number]) => {
      quickAddRule({
        range,
        condition: { type: 'cell_value', operator: 'greater', value: '0' },
        format: {},
        priority: Date.now(),
        kind: 'data_bar',
        dataBar: { color: preset.color, gradient: preset.gradient },
      })
      closeAll()
    },
    [quickAddRule, range, closeAll]
  )

  // ── Color scale click ───────────────────────────────────────────────────
  const applyColorScale = useCallback(
    (preset: (typeof COLOR_SCALE_PRESETS)[number]) => {
      quickAddRule({
        range,
        condition: { type: 'cell_value', operator: 'greater', value: '0' },
        format: {},
        priority: Date.now(),
        kind: 'color_scale',
        colorScale: {
          minColor: preset.minColor,
          ...(preset.midColor !== undefined ? { midColor: preset.midColor } : {}),
          maxColor: preset.maxColor,
        },
      })
      closeAll()
    },
    [quickAddRule, range, closeAll]
  )

  // ── Icon set click ──────────────────────────────────────────────────────
  const applyIconSet = useCallback(
    (preset: (typeof ICON_SET_PRESETS)[number]) => {
      quickAddRule({
        range,
        condition: { type: 'cell_value', operator: 'greater', value: '0' },
        format: {},
        priority: Date.now(),
        kind: 'icon_set',
        iconSet: { name: preset.name, icons: preset.icons },
      })
      closeAll()
    },
    [quickAddRule, range, closeAll]
  )

  // ── Menu item component ─────────────────────────────────────────────────
  const MenuItem = useCallback(
    ({
      label,
      hasSubmenu,
      submenuKey,
      onClick,
    }: {
      label: string
      hasSubmenu?: boolean
      submenuKey?: ActiveSubmenu
      onClick?: () => void
    }) => (
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        onMouseEnter={() => {
          if (hasSubmenu && submenuKey) openSubmenu(submenuKey)
          else openSubmenu(null)
        }}
        onMouseLeave={closeSubmenu}
        onClick={(e) => {
          e.stopPropagation()
          if (onClick) onClick()
        }}
      >
        <span>{label}</span>
        {hasSubmenu && <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
      </button>
    ),
    [openSubmenu, closeSubmenu]
  )

  // ── Submenu wrapper ─────────────────────────────────────────────────────
  const SubmenuPanel = useCallback(
    ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
      if (!visible) return null
      return (
        <div
          className="absolute left-full top-0 ml-1 min-w-[240px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{ zIndex: 301 }}
          onMouseEnter={keepSubmenu}
          onMouseLeave={closeSubmenu}
        >
          {children}
        </div>
      )
    },
    [keepSubmenu, closeSubmenu]
  )

  // ── Trigger + menu position ─────────────────────────────────────────────
  const triggerRect = triggerRef.current?.getBoundingClientRect()

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button — Excel-style large stacked button with caret */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Conditional Formatting"
        title="Conditional Formatting"
        onClick={() => {
          setIsOpen((prev) => !prev)
          setActiveSubmenu(null)
          setInlineDialog(null)
        }}
        className={cn(
          'relative flex h-[68px] w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded px-1 py-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          isOpen
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : 'text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60'
        )}
      >
        {/* Excel-style CF icon: 4 colored cells in a 2x2 grid with a gradient bar */}
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <rect x="2" y="3"  width="9" height="8" rx="1" fill="#F87171" />
          <rect x="13" y="3" width="9" height="8" rx="1" fill="#FBBF24" />
          <rect x="2" y="13" width="9" height="8" rx="1" fill="#34D399" />
          <rect x="13" y="13" width="9" height="8" rx="1" fill="#60A5FA" />
        </svg>
        <div className="flex flex-col items-center leading-[1.05]">
          <span className="text-[10px]">Conditional</span>
          <span className="flex items-center gap-0.5 text-[10px]">
            Formatting
            <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-400" />
          </span>
        </div>
      </button>

      {/* ── Main dropdown ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed min-w-[260px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            zIndex: 300,
            top: triggerRect ? triggerRect.bottom + 4 : 0,
            left: triggerRect ? triggerRect.left : 0,
          }}
        >
          {/* ── 1. Highlight Cells Rules ──────────────────────────────── */}
          <div className="relative">
            <MenuItem
              label="Highlight Cells Rules"
              hasSubmenu
              submenuKey="highlight"
            />
            <SubmenuPanel visible={activeSubmenu === 'highlight' && !inlineDialog}>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Greater Than',
                    type: 'value',
                    conditionType: 'cell_value',
                    operator: 'greater',
                  })
                }
              >
                Greater Than...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Less Than',
                    type: 'value',
                    conditionType: 'cell_value',
                    operator: 'less',
                  })
                }
              >
                Less Than...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Between',
                    type: 'between',
                    conditionType: 'cell_value',
                    operator: 'between',
                  })
                }
              >
                Between...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Equal To',
                    type: 'value',
                    conditionType: 'cell_value',
                    operator: 'equal',
                  })
                }
              >
                Equal To...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Text That Contains',
                    type: 'text',
                    conditionType: 'text_contains',
                    operator: 'contains',
                  })
                }
              >
                Text That Contains...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'A Date Occurring',
                    type: 'date',
                    conditionType: 'date_occurring',
                  })
                }
              >
                A Date Occurring...
              </button>
              <div className="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() => {
                  applyImmediate('duplicate_values', {
                    fill: '#FFC7CE',
                    color: '#9C0006',
                  })
                }}
              >
                Duplicate Values
              </button>
              <div className="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() => {
                  closeAll()
                  onOpenManageRules()
                }}
              >
                More Rules...
              </button>
            </SubmenuPanel>

            {/* Inline dialog shown instead of submenu */}
            {activeSubmenu === 'highlight' && inlineDialog && (
              <div
                className="absolute left-full top-0 ml-1"
                style={{ zIndex: 302 }}
                onMouseEnter={keepSubmenu}
                onMouseLeave={closeSubmenu}
              >
                <CFInlineDialog
                  title={inlineDialog.title}
                  type={inlineDialog.type}
                  onApply={handleInlineApply(inlineDialog)}
                  onCancel={() => setInlineDialog(null)}
                />
              </div>
            )}
          </div>

          {/* ── 2. Top/Bottom Rules ──────────────────────────────────── */}
          <div className="relative">
            <MenuItem
              label="Top/Bottom Rules"
              hasSubmenu
              submenuKey="topBottom"
            />
            <SubmenuPanel visible={activeSubmenu === 'topBottom' && !inlineDialog}>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Top 10 Items',
                    type: 'topN',
                    conditionType: 'top_n',
                  })
                }
              >
                Top 10 Items...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Top 10%',
                    type: 'topNPercent',
                    conditionType: 'top_n_percent',
                  })
                }
              >
                Top 10%...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Bottom 10 Items',
                    type: 'topN',
                    conditionType: 'bottom_n',
                  })
                }
              >
                Bottom 10 Items...
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  setInlineDialog({
                    title: 'Bottom 10%',
                    type: 'topNPercent',
                    conditionType: 'bottom_n_percent',
                  })
                }
              >
                Bottom 10%...
              </button>
              <div className="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  applyImmediate('above_average', {
                    fill: '#C6EFCE',
                    color: '#006100',
                  })
                }
              >
                Above Average
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() =>
                  applyImmediate('below_average', {
                    fill: '#FFC7CE',
                    color: '#9C0006',
                  })
                }
              >
                Below Average
              </button>
              <div className="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() => {
                  closeAll()
                  onOpenManageRules()
                }}
              >
                More Rules...
              </button>
            </SubmenuPanel>

            {/* Inline dialog for top/bottom */}
            {activeSubmenu === 'topBottom' && inlineDialog && (
              <div
                className="absolute left-full top-0 ml-1"
                style={{ zIndex: 302 }}
                onMouseEnter={keepSubmenu}
                onMouseLeave={closeSubmenu}
              >
                <CFInlineDialog
                  title={inlineDialog.title}
                  type={inlineDialog.type}
                  onApply={handleInlineApply(inlineDialog)}
                  onCancel={() => setInlineDialog(null)}
                />
              </div>
            )}
          </div>

          {/* ── 3. Data Bars ─────────────────────────────────────────── */}
          <div className="relative">
            <MenuItem
              label="Data Bars"
              hasSubmenu
              submenuKey="dataBars"
            />
            <SubmenuPanel visible={activeSubmenu === 'dataBars'}>
              <p className="px-3 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Gradient Fill
              </p>
              <div className="grid grid-cols-6 gap-1.5 px-3 pb-2">
                {DATA_BAR_PRESETS.filter((p) => p.gradient).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={() => applyDataBar(preset)}
                    className="h-8 w-8 rounded border border-zinc-300 transition-all hover:border-blue-400 hover:ring-1 hover:ring-blue-300 dark:border-zinc-600 dark:hover:border-blue-500"
                    style={{
                      background: `linear-gradient(to right, ${preset.color}, ${preset.color}33)`,
                    }}
                  />
                ))}
              </div>
              <p className="px-3 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Solid Fill
              </p>
              <div className="grid grid-cols-6 gap-1.5 px-3 pb-2">
                {DATA_BAR_PRESETS.filter((p) => !p.gradient).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={() => applyDataBar(preset)}
                    className="h-8 w-8 rounded border border-zinc-300 transition-all hover:border-blue-400 hover:ring-1 hover:ring-blue-300 dark:border-zinc-600 dark:hover:border-blue-500"
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
            </SubmenuPanel>
          </div>

          {/* ── 4. Color Scales ──────────────────────────────────────── */}
          <div className="relative">
            <MenuItem
              label="Color Scales"
              hasSubmenu
              submenuKey="colorScales"
            />
            <SubmenuPanel visible={activeSubmenu === 'colorScales'}>
              <div className="grid grid-cols-6 gap-1.5 px-3 py-2">
                {COLOR_SCALE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={() => applyColorScale(preset)}
                    className="h-8 w-8 rounded border border-zinc-300 transition-all hover:border-blue-400 hover:ring-1 hover:ring-blue-300 dark:border-zinc-600 dark:hover:border-blue-500"
                    style={{
                      background: preset.midColor
                        ? `linear-gradient(to right, ${preset.minColor}, ${preset.midColor}, ${preset.maxColor})`
                        : `linear-gradient(to right, ${preset.minColor}, ${preset.maxColor})`,
                    }}
                  />
                ))}
              </div>
            </SubmenuPanel>
          </div>

          {/* ── 5. Icon Sets ─────────────────────────────────────────── */}
          <div className="relative">
            <MenuItem
              label="Icon Sets"
              hasSubmenu
              submenuKey="iconSets"
            />
            <SubmenuPanel visible={activeSubmenu === 'iconSets'}>
              {ICON_CATEGORIES.map((category) => {
                const presets = ICON_SET_PRESETS.filter((p) => p.category === category)
                if (presets.length === 0) return null
                return (
                  <div key={category}>
                    <p className="px-3 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {category}
                    </p>
                    {presets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                        onClick={() => applyIconSet(preset)}
                      >
                        <span className="flex gap-0.5 text-base">
                          {preset.icons.map((icon, idx) => (
                            <span key={idx}>{icon}</span>
                          ))}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </SubmenuPanel>
          </div>

          {/* ── Separator ────────────────────────────────────────────── */}
          <div className="mx-2 my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          {/* ── 7. New Rule ──────────────────────────────────────────── */}
          <MenuItem
            label="New Rule..."
            onClick={() => {
              closeAll()
              onOpenManageRules()
            }}
          />

          {/* ── 8. Clear Rules ───────────────────────────────────────── */}
          <div className="relative">
            <MenuItem
              label="Clear Rules"
              hasSubmenu
              submenuKey="clearRules"
            />
            <SubmenuPanel visible={activeSubmenu === 'clearRules'}>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() => {
                  clearFromSheet(activeSheetId)
                  closeAll()
                }}
              >
                Clear Rules from Selected Cells
              </button>
              <button
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
                onClick={() => {
                  clearFromSheet(activeSheetId)
                  closeAll()
                }}
              >
                Clear Rules from Entire Sheet
              </button>
            </SubmenuPanel>
          </div>

          {/* ── 9. Manage Rules ──────────────────────────────────────── */}
          <MenuItem
            label="Manage Rules..."
            onClick={() => {
              closeAll()
              onOpenManageRules()
            }}
          />
        </div>
      )}
    </div>
  )
}
