'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * RibbonGroup — vertical block on the ribbon containing several buttons,
 * with a small label at the bottom and a divider on the right edge (Excel-style).
 */
export function RibbonGroup({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative flex h-full flex-col items-stretch px-2', className)}>
      <div className="flex flex-1 items-center gap-0.5">{children}</div>
      <div className="pt-0.5 text-center text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="absolute right-0 top-2 h-[60px] w-px bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )
}

/** Compact (small) icon button — 24×24 — for dense rows. */
export function RibbonButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
  shortcut,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: (() => void) | undefined
  shortcut?: string
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-[26px] w-[26px] items-center justify-center rounded transition-colors',
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  )
}

/** Large stacked button — 56×56 — icon on top, label below. Used for primary commands. */
export function RibbonLargeButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
  showCaret = false,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: (() => void) | undefined
  showCaret?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-[68px] w-[60px] flex-col items-center justify-center gap-1 rounded px-1 py-1 text-[11px] transition-colors',
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <div className="flex h-7 w-7 items-center justify-center [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </div>
      <div className="flex items-center gap-0.5 leading-tight">
        <span className="max-w-[58px] truncate">{label}</span>
        {showCaret ? <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" /> : null}
      </div>
    </button>
  )
}

/** A small button with a caret on its right edge (e.g. "B ▾" used by font color/fill). */
export function RibbonSplitButton({
  label,
  icon,
  caret,
  active = false,
  onMainClick,
  onCaretClick,
  shortcut,
}: {
  label: string
  icon: ReactNode
  caret?: boolean
  active?: boolean
  onMainClick?: () => void
  onCaretClick?: () => void
  shortcut?: string
}) {
  return (
    <div className="inline-flex h-[26px] items-stretch overflow-hidden rounded">
      <button
        type="button"
        title={shortcut ? `${label} (${shortcut})` : label}
        aria-label={label}
        aria-pressed={active}
        onClick={onMainClick}
        className={cn(
          'flex w-[26px] items-center justify-center transition-colors',
          active
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
        )}
      >
        {icon}
      </button>
      {caret ? (
        <button
          type="button"
          aria-label={`${label} options`}
          onClick={onCaretClick}
          className="flex w-3.5 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  )
}

/** Width-bounded combobox-style selector (used for font family + size). */
export function RibbonCombo({
  value,
  width,
  onClick,
  title,
}: {
  value: string
  width: number
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? value}
      style={{ width }}
      className="flex h-[26px] items-center justify-between gap-1 rounded border border-zinc-300 bg-white px-2 text-[12px] text-zinc-700 transition-colors hover:border-blue-400 hover:bg-zinc-50 focus-visible:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <span className="truncate">{value}</span>
      <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" />
    </button>
  )
}

/** Hook to detect outside-click for a dropdown anchor. */
export function useOutsideClick(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])
  return ref
}

/** Floating popover anchored under a button. Use with portal-less inline positioning. */
export function RibbonPopover({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const ref = useOutsideClick(open, onClose)
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn(
        'absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Trivial state hook for popovers that anchor to a button. */
export function useDropdownState() {
  const [open, setOpen] = useState(false)
  return {
    open,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  }
}
