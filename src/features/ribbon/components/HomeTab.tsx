'use client'

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownNarrowWide,
  ArrowUpDown,
  Bold,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Eraser,
  Italic,
  Merge as MergeIcon,
  Paintbrush,
  Percent,
  Redo2,
  Scissors,
  Search,
  Sigma,
  Strikethrough,
  Underline,
  Undo2,
  WrapText,
} from 'lucide-react'
import { useSheetStore } from '@/store/sheetStore'
import { FontFamilySelector } from '@/features/toolbar/components/FontFamilySelector'
import { FontSizeSelector } from '@/features/toolbar/components/FontSizeSelector'
import { NumberFormatSelector } from '@/features/toolbar/components/NumberFormatSelector'
import { ColorPicker, NO_FILL } from '@/features/toolbar/components/ColorPicker'
import { CFDropdownMenu } from '@/features/conditional-formatting/components/CFDropdownMenu'
import { CellStylesDropdown } from '@/features/conditional-formatting/components/CellStylesDropdown'
import { FormatAsTableDropdown } from './FormatAsTableDropdown'
import { CellsGroup } from './CellsGroup'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FontFamily, NumberFormat } from '@/types/sheet.types'
import { RibbonGroup, RibbonButton, RibbonIconLabel } from './RibbonPrimitives'
import { BordersDropdown } from './BordersDropdown'
import { AccountingDropdown } from './AccountingDropdown'
import { SeriesDialog } from './SeriesDialog'
import { useInsertFunctionStore } from '@/features/formula-engine/stores/insertFunctionStore'
import { useState } from 'react'
import { ribbonStub } from '../utils/ribbonStub'
import {
  applyAutoSumOp,
  applyCustomNumberFormat,
  applyOrientation,
  mergeAcross,
  clearAll,
  clearComments,
  clearContents,
  clearFilter,
  clearHyperlinks,
  decreaseDecimal,
  decreaseIndent,
  fillDown,
  fillLeft,
  fillRight,
  fillUp,
  goToDialog,
  increaseDecimal,
  increaseIndent,
  reapplyFilter,
  selectCellsWithCF,
  selectCellsWithComments,
  selectCellsWithConstants,
  selectCellsWithFormulas,
  selectCellsWithValidation,
  startFormatPainter,
  type OrientationPreset,
} from '../utils/cellOps'
import { copySelection, cutSelection, pasteFromClipboard } from '../utils/clipboardOps'

interface HomeTabProps {
  onSortAsc: () => void
  onSortDesc: () => void
  onFilter: () => void
  onFind: () => void
  onConditionalFormatting: () => void
  onMergeCells: () => void
  onUnmergeCells: () => void
  onClearFormatting: () => void
  onAutoSum?: (() => void) | undefined
  onInsertRow?: (() => void) | undefined
  onDeleteRow?: (() => void) | undefined
  onInsertSheet?: (() => void) | undefined
  onProtectedRanges?: (() => void) | undefined
  onCustomSort?: (() => void) | undefined
  onAIAssistant: () => void
}

export function HomeTab(props: HomeTabProps) {
  const { gridInstance, activeFormatting, applyFormatToSelection } = useSheetStore()

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
  // ColorPicker emits `NO_FILL` when the user clicks "No Fill"; translate
  // that to an empty string so the format-apply path clears the cell's
  // backgroundColor / textColor (rather than literally writing the
  // sentinel as a CSS colour value).
  const setTextColor = (textColor: string) =>
    applyFormatToSelection({ textColor: textColor === NO_FILL ? '' : textColor })
  const setBgColor = (backgroundColor: string) =>
    applyFormatToSelection({ backgroundColor: backgroundColor === NO_FILL ? '' : backgroundColor })

  // R7.2 — Series dialog open state (replaces the previous chained prompts).
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)

  const bumpFont = (delta: number) => {
    const next = Math.max(8, Math.min(72, (activeFormatting.fontSize ?? 11) + delta))
    setFontSize(next)
  }

  return (
    <div className="flex h-full items-stretch overflow-x-auto">
      {/* ── 1. Clipboard ─────────────────────────────────────── */}
      <RibbonGroup label="Clipboard">
        {/* Paste — Excel-style split button.
            Top half (icon): default paste.
            Bottom half (label + caret): opens the Paste Special menu.
            A thin border separates the halves visually so users see
            two distinct click targets, like Excel's real split button. */}
        <DropdownMenu>
          <div className="flex flex-col items-stretch overflow-hidden rounded border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
            <button
              type="button"
              title="Paste (Ctrl+V)"
              onClick={() => pasteFromClipboard('all')}
              className="flex h-[52px] w-[60px] flex-col items-center justify-center px-1 pt-1 text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <ClipboardPaste className="h-6 w-6 text-zinc-700 dark:text-zinc-200" />
            </button>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Paste options"
                className="flex h-[20px] w-[60px] items-center justify-center gap-0.5 border-t border-zinc-200 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Paste <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => void pasteFromClipboard('all')}>
              Paste
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void pasteFromClipboard('values')}>
              Paste Values only
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void pasteFromClipboard('formulas')}>
              Paste Formulas only
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void pasteFromClipboard('formatting')}>
              Paste Formatting only
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void pasteFromClipboard('transpose')}>
              Paste Transpose
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void pasteFromClipboard('link')}>
              Paste Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Right column: Cut / Copy / Format Painter with icon + text
            labels (Excel-faithful) instead of icon-only. 3 stacked
            buttons at 20px each + 2*2px gaps = 64px, fits within the
            80px content area with room for the group label. */}
        <div className="flex flex-col gap-0.5">
          <RibbonIconLabel label="Cut"            shortcut="Ctrl+X" icon={<Scissors className="h-3.5 w-3.5" />}    onClick={() => void cutSelection()} />
          <RibbonIconLabel label="Copy"           shortcut="Ctrl+C" icon={<Copy className="h-3.5 w-3.5" />}        onClick={() => void copySelection()} />
          <RibbonIconLabel label="Format Painter"                   icon={<Paintbrush className="h-3.5 w-3.5" />}  onClick={startFormatPainter} />
        </div>
      </RibbonGroup>

      {/* ── 2. Font ───────────────────────────────────────────── */}
      <RibbonGroup label="Font">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <FontFamilySelector value={activeFormatting.fontFamily} onChange={setFontFamily} />
            <FontSizeSelector value={activeFormatting.fontSize} onChange={setFontSize} />
            <RibbonButton label="Increase Font Size" icon={<span className="text-[10px] font-bold leading-none">A▴</span>} onClick={() => bumpFont(1)} />
            <RibbonButton label="Decrease Font Size" icon={<span className="text-[9px] font-bold leading-none">A▾</span>}  onClick={() => bumpFont(-1)} />
          </div>
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Bold" shortcut="Ctrl+B" icon={<Bold className="h-3.5 w-3.5" />} active={activeFormatting.bold} onClick={() => toggle('bold')} />
            <RibbonButton label="Italic" shortcut="Ctrl+I" icon={<Italic className="h-3.5 w-3.5" />} active={activeFormatting.italic} onClick={() => toggle('italic')} />
            <RibbonButton label="Underline" shortcut="Ctrl+U" icon={<Underline className="h-3.5 w-3.5" />} active={activeFormatting.underline} onClick={() => toggle('underline')} />
            <RibbonButton label="Strikethrough" shortcut="Ctrl+5" icon={<Strikethrough className="h-3.5 w-3.5" />} active={activeFormatting.strikethrough} onClick={() => toggle('strikethrough')} />
            {/* Borders dropdown (R2.3) — visual grid + line color + line style.
                Replaces the previous text-only DropdownMenu list. */}
            <BordersDropdown />
            <ColorPicker
              value={activeFormatting.backgroundColor ?? '#ffff00'}
              onChange={setBgColor}
              label="Fill color"
              allowNoFill
              trigger={
                <span className="text-[10px] font-bold leading-none text-zinc-700 dark:text-zinc-300">▣</span>
              }
            />
            <ColorPicker
              value={activeFormatting.textColor ?? '#FF0000'}
              onChange={setTextColor}
              label="Text color"
              allowNoFill
              trigger={
                <span className="text-[10px] font-bold leading-none" style={{ color: activeFormatting.textColor ?? '#000000' }}>A</span>
              }
            />
          </div>
        </div>
      </RibbonGroup>

      {/* ── 3. Alignment ──────────────────────────────────────── */}
      <RibbonGroup label="Alignment">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Top align"    icon={<AlignVerticalJustifyStart  className="h-3.5 w-3.5" />} active={activeFormatting.verticalAlign === 'top'}    onClick={() => setVAlign('top')} />
            <RibbonButton label="Middle align" icon={<AlignVerticalJustifyCenter className="h-3.5 w-3.5" />} active={activeFormatting.verticalAlign === 'middle'} onClick={() => setVAlign('middle')} />
            <RibbonButton label="Bottom align" icon={<AlignVerticalJustifyEnd    className="h-3.5 w-3.5" />} active={activeFormatting.verticalAlign === 'bottom'} onClick={() => setVAlign('bottom')} />
            <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Orientation"
                  className="flex h-[26px] items-center gap-0.5 rounded px-1.5 text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span className="text-[10px] italic leading-none">↻ab</span>
                  <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => applyOrientation(0)}>Horizontal</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyOrientation(45 as OrientationPreset)}>Angle Counterclockwise (45°)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyOrientation(-45 as OrientationPreset)}>Angle Clockwise (-45°)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyOrientation('vertical')}>Vertical Text</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyOrientation(90 as OrientationPreset)}>Rotate Up (90°)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyOrientation(-90 as OrientationPreset)}>Rotate Down (-90°)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <RibbonButton label="Wrap text" icon={<WrapText className="h-3.5 w-3.5" />} active={activeFormatting.wrapText} onClick={() => toggle('wrapText')} />
          </div>
          <div className="flex items-center gap-0.5">
            <RibbonButton label="Align left"   icon={<AlignLeft   className="h-3.5 w-3.5" />} active={activeFormatting.textAlign === 'left'}   onClick={() => setAlign('left')} />
            <RibbonButton label="Align center" icon={<AlignCenter className="h-3.5 w-3.5" />} active={activeFormatting.textAlign === 'center'} onClick={() => setAlign('center')} />
            <RibbonButton label="Align right"  icon={<AlignRight  className="h-3.5 w-3.5" />} active={activeFormatting.textAlign === 'right'}  onClick={() => setAlign('right')} />
            <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            <RibbonButton label="Decrease Indent" icon={<span className="text-[12px] leading-none">←|</span>} onClick={decreaseIndent} />
            <RibbonButton label="Increase Indent" icon={<span className="text-[12px] leading-none">|→</span>} onClick={increaseIndent} />
            <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
            {/* Merge & Center dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Merge & Center"
                  className="flex h-[26px] items-center gap-0.5 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <MergeIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Merge</span>
                  <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => { props.onMergeCells(); setAlign('center') }}>Merge &amp; Center</DropdownMenuItem>
                <DropdownMenuItem onSelect={mergeAcross}>Merge Across</DropdownMenuItem>
                <DropdownMenuItem onSelect={props.onMergeCells}>Merge Cells</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={props.onUnmergeCells}>Unmerge Cells</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </RibbonGroup>

      {/* ── 4. Number ─────────────────────────────────────────── */}
      <RibbonGroup label="Number">
        <div className="flex flex-col gap-0.5">
          {/* Top row: format dropdown takes ~120px to align with bottom row */}
          <div className="flex h-7 items-center">
            <NumberFormatSelector value={activeFormatting.numberFormat} onChange={setNumberFormat} />
          </div>
          {/* Bottom row: 3 narrow buttons (26px) + 2 wider buttons (32px) = ~138px */}
          <div className="flex items-center gap-0.5">
            {/* Accounting split-button (R4.1): icon applies the last-picked
                currency symbol; caret opens the currency selector. Default
                derived from system locale (`₹` for en-IN). */}
            <AccountingDropdown
              active={activeFormatting.numberFormat === 'currency' || activeFormatting.numberFormat === 'accounting'}
              onApply={applyCustomNumberFormat}
            />
            <RibbonButton label="Percent Style"       shortcut="Ctrl+Shift+%" icon={<Percent className="h-3.5 w-3.5" />} active={activeFormatting.numberFormat === 'percentage'} onClick={() => setNumberFormat('percentage')} />
            <RibbonButton label="Comma Style"          icon={<span className="text-[13px] font-semibold leading-none">,</span>} active={activeFormatting.numberFormat === 'number'} onClick={() => setNumberFormat('number')} />
            {/* Increase / Decrease decimal — wider buttons (34px) to fit ".0→.00" text without wrapping */}
            <button
              type="button"
              title="Increase Decimal"
              aria-label="Increase Decimal"
              onClick={increaseDecimal}
              className="flex h-[26px] w-[34px] items-center justify-center rounded text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span className="whitespace-nowrap text-[9px] font-medium leading-none tracking-tight">.0&rarr;.00</span>
            </button>
            <button
              type="button"
              title="Decrease Decimal"
              aria-label="Decrease Decimal"
              onClick={decreaseDecimal}
              className="flex h-[26px] w-[34px] items-center justify-center rounded text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span className="whitespace-nowrap text-[9px] font-medium leading-none tracking-tight">.00&rarr;.0</span>
            </button>
          </div>
        </div>
      </RibbonGroup>

      {/* ── 5. Styles ─────────────────────────────────────────── */}
      <RibbonGroup label="Styles">
        <CFDropdownMenu onOpenManageRules={props.onConditionalFormatting} />
        <FormatAsTableDropdown />
        <CellStylesDropdown />
      </RibbonGroup>

      {/* ── 6. Cells ──────────────────────────────────────────── */}
      <RibbonGroup label="Cells">
        <CellsGroup
          onInsertRow={props.onInsertRow}
          onDeleteRow={props.onDeleteRow}
          onInsertSheet={props.onInsertSheet}
          onProtectedRanges={props.onProtectedRanges}
        />
      </RibbonGroup>

      {/* ── 7. Editing ────────────────────────────────────────── */}
      <RibbonGroup label="Editing" className="border-r-0">
        {/* AutoSum dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="AutoSum"
              className="flex h-[68px] w-[58px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Sigma className="h-6 w-6 text-orange-500" />
              <span className="flex items-center gap-0.5 leading-tight">
                AutoSum <ChevronDown className="h-3 w-3 text-zinc-400" />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => props.onAutoSum?.()}>Sum</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyAutoSumOp('AVERAGE')}>Average</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyAutoSumOp('COUNT')}>Count Numbers</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyAutoSumOp('MAX')}>Max</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => applyAutoSumOp('MIN')}>Min</DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* R7.1 — open the Insert Function dialog (Shift+F3) which is
                already built. Was previously a stub showing a "coming soon"
                toast even though the dialog has shipped for months. */}
            <DropdownMenuItem
              onSelect={() => useInsertFunctionStore.getState().setOpen(true)}
            >
              More Functions…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col gap-0.5">
          {/* Fill dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-[22px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <ArrowDownNarrowWide className="h-3.5 w-3.5" />
                Fill
                <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={fillDown}>Down</DropdownMenuItem>
              <DropdownMenuItem onSelect={fillRight}>Right</DropdownMenuItem>
              <DropdownMenuItem onSelect={fillUp}>Up</DropdownMenuItem>
              <DropdownMenuItem onSelect={fillLeft}>Left</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSeriesDialogOpen(true)}>
                Series…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={ribbonStub('Flash Fill')}>Flash Fill</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Clear dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-[22px] items-center gap-1 rounded px-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <Eraser className="h-3.5 w-3.5" />
                Clear
                <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={clearAll}>Clear All</DropdownMenuItem>
              <DropdownMenuItem onSelect={props.onClearFormatting}>Clear Formats</DropdownMenuItem>
              <DropdownMenuItem onSelect={clearContents}>Clear Contents</DropdownMenuItem>
              <DropdownMenuItem onSelect={clearComments}>Clear Comments</DropdownMenuItem>
              <DropdownMenuItem onSelect={clearHyperlinks}>Clear Hyperlinks</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Sort & Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Sort & Filter"
              className="flex h-[68px] w-[60px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <ArrowUpDown className="h-6 w-6" />
              <span className="flex flex-col items-center leading-[1.05]">
                <span>Sort &amp;</span>
                <span className="flex items-center gap-0.5">Filter <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={props.onSortAsc}>Sort A → Z</DropdownMenuItem>
            <DropdownMenuItem onSelect={props.onSortDesc}>Sort Z → A</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onCustomSort?.()}>Custom Sort…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={props.onFilter}>Filter</DropdownMenuItem>
            <DropdownMenuItem onSelect={clearFilter}>Clear</DropdownMenuItem>
            <DropdownMenuItem onSelect={reapplyFilter}>Reapply</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Find & Select dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Find & Select"
              className="flex h-[68px] w-[60px] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Search className="h-6 w-6" />
              <span className="flex flex-col items-center leading-[1.05]">
                <span>Find &amp;</span>
                <span className="flex items-center gap-0.5">Select <ChevronDown className="h-3 w-3 text-zinc-400" /></span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={props.onFind}>Find…</DropdownMenuItem>
            <DropdownMenuItem onSelect={props.onFind}>Replace…</DropdownMenuItem>
            <DropdownMenuItem onSelect={goToDialog}>Go To…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={selectCellsWithFormulas}>Formulas</DropdownMenuItem>
            <DropdownMenuItem onSelect={selectCellsWithComments}>Comments</DropdownMenuItem>
            <DropdownMenuItem onSelect={selectCellsWithCF}>Conditional Formatting</DropdownMenuItem>
            <DropdownMenuItem onSelect={selectCellsWithConstants}>Constants</DropdownMenuItem>
            <DropdownMenuItem onSelect={selectCellsWithValidation}>Data Validation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Undo/Redo — compact column.
            Previously had 4 buttons (Undo/Redo/Sort/Filter) but Sort
            and Filter were duplicates of the Sort & Filter dropdown
            immediately to the left, AND 4*26+3*2 = 110px overflowed
            the 80px content area. Trimmed to just Undo/Redo so the
            column is 2*26+2 = 54px and fits comfortably with the
            group label visible below. */}
        <div className="ml-1 flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
          <RibbonButton label="Undo" shortcut="Ctrl+Z" icon={<Undo2 className="h-3.5 w-3.5" />} disabled={!gridInstance} onClick={() => gridInstance?.handleUndo()} />
          <RibbonButton label="Redo" shortcut="Ctrl+Y" icon={<Redo2 className="h-3.5 w-3.5" />} disabled={!gridInstance} onClick={() => gridInstance?.handleRedo()} />
        </div>
      </RibbonGroup>

      {/* R7.2 — Fill > Series dialog. Mounted at the ribbon root so it
          renders above the grid. Open state is local to HomeTab. */}
      <SeriesDialog open={seriesDialogOpen} onOpenChange={setSeriesDialogOpen} />
    </div>
  )
}
