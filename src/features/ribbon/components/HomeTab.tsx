'use client'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownAZ,
  ArrowUpAZ,
  Bold,
  ChevronDown,
  Clipboard,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  DollarSign,
  Eraser,
  Filter,
  Italic,
  Minus,
  Palette,
  Percent,
  Plus,
  Search,
  Sigma,
  Strikethrough,
  Table,
  Type,
  Underline,
  WrapText,
} from 'lucide-react'
import { useSheetStore } from '@/store/sheetStore'
import { FontFamilySelector } from '@/features/toolbar/components/FontFamilySelector'
import { FontSizeSelector } from '@/features/toolbar/components/FontSizeSelector'
import { NumberFormatSelector } from '@/features/toolbar/components/NumberFormatSelector'
import { ColorPicker } from '@/features/toolbar/components/ColorPicker'
import type { FontFamily, NumberFormat } from '@/types/sheet.types'
import { RibbonGroup, RibbonButton, RibbonLargeButton } from './RibbonPrimitives'

interface HomeTabProps {
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onFind: () => void
  onConditionalFormatting: () => void
  onMergeCells: () => void
  onUnmergeCells: () => void
  onClearFormatting: () => void
  onValidation: () => void
}

export function HomeTab(props: HomeTabProps) {
  const { activeFormatting, applyFormatToSelection } = useSheetStore()

  const toggle = (key: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'wrapText') =>
    applyFormatToSelection({ [key]: !activeFormatting[key] })

  const setAlign = (align: 'left' | 'center' | 'right') =>
    applyFormatToSelection({ textAlign: align })
  const setVAlign = (vAlign: 'top' | 'middle' | 'bottom') =>
    applyFormatToSelection({ verticalAlign: vAlign })

  const setNumberFormat = (numberFormat: NumberFormat) =>
    applyFormatToSelection({ numberFormat })
  const setFontFamily = (fontFamily: FontFamily) => applyFormatToSelection({ fontFamily })
  const setFontSize = (fontSize: number) => applyFormatToSelection({ fontSize })
  const setTextColor = (textColor: string) => applyFormatToSelection({ textColor })
  const setBgColor = (backgroundColor: string) => applyFormatToSelection({ backgroundColor })

  return (
    <div className="flex h-full items-stretch overflow-x-auto px-1 py-1.5">
      {/* Clipboard */}
      <RibbonGroup label="Clipboard">
        <RibbonLargeButton
          label="Paste"
          icon={<ClipboardPaste />}
          onClick={() => {
            // Paste handled by FortuneSheet's native Ctrl+V; this caret stub
            // surfaces a hint for future "Paste special" submenu.
          }}
          showCaret
        />
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Cut" icon={<Clipboard className="h-3.5 w-3.5" />} shortcut="Ctrl+X" />
          <RibbonButton label="Copy" icon={<Copy className="h-3.5 w-3.5" />} shortcut="Ctrl+C" onClick={() => document.execCommand('copy')} />
          <RibbonButton label="Format painter" icon={<ClipboardCopy className="h-3.5 w-3.5" />} />
        </div>
      </RibbonGroup>

      {/* Font */}
      <RibbonGroup label="Font" className="min-w-[280px]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <FontFamilySelector value={activeFormatting.fontFamily} onChange={setFontFamily} />
            <FontSizeSelector value={activeFormatting.fontSize} onChange={setFontSize} />
          </div>
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Bold" shortcut="Ctrl+B" icon={<Bold className="h-3.5 w-3.5" />} active={activeFormatting.bold} onClick={() => toggle('bold')} />
            <RibbonButton label="Italic" shortcut="Ctrl+I" icon={<Italic className="h-3.5 w-3.5" />} active={activeFormatting.italic} onClick={() => toggle('italic')} />
            <RibbonButton label="Underline" shortcut="Ctrl+U" icon={<Underline className="h-3.5 w-3.5" />} active={activeFormatting.underline} onClick={() => toggle('underline')} />
            <RibbonButton label="Strikethrough" icon={<Strikethrough className="h-3.5 w-3.5" />} active={activeFormatting.strikethrough} onClick={() => toggle('strikethrough')} />
            <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <ColorPicker
              value={activeFormatting.backgroundColor ?? '#ffff00'}
              onChange={setBgColor}
              label="Fill color"
              trigger={
                <Palette
                  className="h-3.5 w-3.5"
                  style={{ color: activeFormatting.backgroundColor ?? '#ffff00' }}
                />
              }
            />
            <ColorPicker
              value={activeFormatting.textColor ?? '#000000'}
              onChange={setTextColor}
              label="Text color"
              trigger={
                <span className="flex h-3.5 w-3.5 flex-col items-center">
                  <Type className="h-3 w-3" />
                  <span
                    className="mt-0.5 block h-0.5 w-3"
                    style={{ backgroundColor: activeFormatting.textColor ?? '#000000' }}
                  />
                </span>
              }
            />
          </div>
        </div>
      </RibbonGroup>

      {/* Alignment */}
      <RibbonGroup label="Alignment" className="min-w-[200px]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Top align" icon={<AlignVerticalJustifyStart className="h-3.5 w-3.5" />} active={activeFormatting.verticalAlign === 'top'} onClick={() => setVAlign('top')} />
            <RibbonButton label="Middle align" icon={<AlignVerticalJustifyCenter className="h-3.5 w-3.5" />} active={activeFormatting.verticalAlign === 'middle'} onClick={() => setVAlign('middle')} />
            <RibbonButton label="Bottom align" icon={<AlignVerticalJustifyEnd className="h-3.5 w-3.5" />} active={activeFormatting.verticalAlign === 'bottom'} onClick={() => setVAlign('bottom')} />
            <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <RibbonButton label="Wrap text" icon={<WrapText className="h-3.5 w-3.5" />} active={activeFormatting.wrapText} onClick={() => toggle('wrapText')} />
          </div>
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Align left" icon={<AlignLeft className="h-3.5 w-3.5" />} active={activeFormatting.textAlign === 'left'} onClick={() => setAlign('left')} />
            <RibbonButton label="Align center" icon={<AlignCenter className="h-3.5 w-3.5" />} active={activeFormatting.textAlign === 'center'} onClick={() => setAlign('center')} />
            <RibbonButton label="Align right" icon={<AlignRight className="h-3.5 w-3.5" />} active={activeFormatting.textAlign === 'right'} onClick={() => setAlign('right')} />
            <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <button
              type="button"
              onClick={props.onMergeCells}
              title="Merge cells (Ctrl+Shift+M)"
              className="flex h-[26px] items-center gap-1 rounded px-2 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Merge
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
          </div>
        </div>
      </RibbonGroup>

      {/* Number */}
      <RibbonGroup label="Number" className="min-w-[180px]">
        <div className="flex flex-col gap-0.5">
          <NumberFormatSelector value={activeFormatting.numberFormat} onChange={setNumberFormat} />
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Currency" icon={<DollarSign className="h-3.5 w-3.5" />} onClick={() => setNumberFormat('currency')} />
            <RibbonButton label="Percent" icon={<Percent className="h-3.5 w-3.5" />} onClick={() => setNumberFormat('percentage')} />
            <RibbonButton label="Comma style" icon={<span className="text-[10px] font-semibold">,</span>} onClick={() => setNumberFormat('number')} />
          </div>
        </div>
      </RibbonGroup>

      {/* Styles */}
      <RibbonGroup label="Styles" className="min-w-[160px]">
        <RibbonLargeButton
          label="Conditional"
          icon={<Palette className="text-purple-500" />}
          onClick={props.onConditionalFormatting}
          showCaret
        />
        <RibbonLargeButton
          label="Format Table"
          icon={<Table className="text-blue-500" />}
          onClick={props.onValidation}
          showCaret
        />
      </RibbonGroup>

      {/* Cells */}
      <RibbonGroup label="Cells" className="min-w-[140px]">
        <div className="flex flex-col gap-0.5">
          <RibbonButton label="Insert row" icon={<Plus className="h-3.5 w-3.5" />} />
          <RibbonButton label="Delete row" icon={<Minus className="h-3.5 w-3.5" />} />
          <button
            type="button"
            onClick={props.onClearFormatting}
            className="flex h-[26px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Eraser className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </RibbonGroup>

      {/* Editing */}
      <RibbonGroup label="Editing" className="min-w-[180px] border-r-0">
        <RibbonLargeButton
          label="AutoSum"
          icon={<Sigma className="text-orange-500" />}
          showCaret
        />
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={props.onSortAsc}
            title="Sort A → Z"
            className="flex h-[26px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ArrowDownAZ className="h-3.5 w-3.5" />
            <span>Sort A→Z</span>
          </button>
          <button
            type="button"
            onClick={props.onSortDesc}
            title="Sort Z → A"
            className="flex h-[26px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ArrowUpAZ className="h-3.5 w-3.5" />
            <span>Sort Z→A</span>
          </button>
          <button
            type="button"
            onClick={props.onFilter}
            title="Create filter"
            className="flex h-[26px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
          </button>
          <button
            type="button"
            onClick={props.onFind}
            title="Find & replace (Ctrl+F)"
            className="flex h-[26px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Find</span>
          </button>
        </div>
      </RibbonGroup>
    </div>
  )
}
