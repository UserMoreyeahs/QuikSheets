'use client'

/**
 * AccountingDropdown — Excel-style split button for currency formatting.
 *
 *   ┌──────┬─┐
 *   │  ₹   │▾│   ← top: apply last symbol (single click)
 *   └──────┴─┘    └ caret: pick from $, €, £, ¥, ₹, …
 *
 * The last-selected symbol persists in localStorage so subsequent
 * clicks on the icon half re-apply it immediately, matching Excel's
 * Accounting button behaviour. The initial default is derived from
 * the browser locale:
 *
 *   en-IN → ₹    en-GB → £    en-US / default → $
 *   ja-JP → ¥    de-DE / fr-FR / en-EU / it / es → €
 *
 * Selecting a symbol applies the cell format AND updates the saved
 * default, so a user's choice sticks.
 */

import { useEffect, useState } from 'react'
import { ChevronDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const STORAGE_KEY = 'quiksheets_currency_symbol'

interface Currency {
  symbol: string
  code: string
  label: string
  /** Excel-style accounting format string. */
  format: string
}

const CURRENCIES: Currency[] = [
  { symbol: '$', code: 'USD', label: 'US Dollar',     format: '$#,##0.00;[Red]-$#,##0.00' },
  { symbol: '€', code: 'EUR', label: 'Euro',          format: '€#,##0.00;[Red]-€#,##0.00' },
  { symbol: '£', code: 'GBP', label: 'British Pound', format: '£#,##0.00;[Red]-£#,##0.00' },
  { symbol: '¥', code: 'JPY', label: 'Japanese Yen',  format: '¥#,##0;[Red]-¥#,##0' },
  { symbol: '₹', code: 'INR', label: 'Indian Rupee',  format: '₹#,##,##0.00;[Red]-₹#,##,##0.00' },
  { symbol: '元', code: 'CNY', label: 'Chinese Yuan',  format: '¥#,##0.00;[Red]-¥#,##0.00' },
]

/** Best-effort locale → currency symbol mapping. */
function localeDefault(): string {
  if (typeof navigator === 'undefined') return '$'
  const loc = navigator.language?.toLowerCase() ?? 'en-us'
  if (loc.includes('in')) return '₹'
  if (loc.includes('gb') || loc.includes('uk')) return '£'
  if (loc.includes('jp')) return '¥'
  if (loc.includes('cn')) return '元'
  if (loc.startsWith('de') || loc.startsWith('fr') || loc.startsWith('it') || loc.startsWith('es') || loc.startsWith('nl') || loc.startsWith('pt')) return '€'
  return '$'
}

function loadSymbol(): string {
  if (typeof window === 'undefined') return localeDefault()
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch {
    /* ignore */
  }
  return localeDefault()
}

function saveSymbol(symbol: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, symbol)
  } catch {
    /* ignore */
  }
}

interface AccountingDropdownProps {
  /** Whether the active cell already has an accounting/currency format. */
  active?: boolean
  /** Called with the chosen Excel-style format string. */
  onApply: (format: string) => void
}

export function AccountingDropdown({ active = false, onApply }: AccountingDropdownProps) {
  const [symbol, setSymbol] = useState<string>('$')

  // Hydrate from storage / locale on mount.
  useEffect(() => {
    setSymbol(loadSymbol())
  }, [])

  function applyCurrency(c: Currency) {
    setSymbol(c.symbol)
    saveSymbol(c.symbol)
    onApply(c.format)
  }

  function applyCurrent() {
    const c = CURRENCIES.find((x) => x.symbol === symbol) ?? CURRENCIES[0]!
    onApply(c.format)
  }

  return (
    <DropdownMenu>
      <div className="inline-flex h-[26px] items-stretch overflow-hidden rounded">
        <button
          type="button"
          title={`Accounting (${symbol})`}
          aria-label="Accounting Format"
          aria-pressed={active}
          onClick={applyCurrent}
          className={cn(
            'flex w-[26px] items-center justify-center transition-colors',
            active
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
          )}
        >
          {symbol === '$' ? (
            <DollarSign className="h-3.5 w-3.5" />
          ) : (
            <span className="text-[13px] font-semibold leading-none">{symbol}</span>
          )}
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Currency symbol"
            className="flex w-3 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-400">
          Currency Symbol
        </DropdownMenuLabel>
        {CURRENCIES.map((c) => (
          <DropdownMenuItem
            key={c.code}
            onSelect={() => applyCurrency(c)}
            className="flex items-center justify-between"
          >
            <span>
              <span className="mr-2 inline-block w-5 text-center font-semibold">{c.symbol}</span>
              {c.label}
              <span className="ml-2 text-[10px] text-zinc-400">{c.code}</span>
            </span>
            {symbol === c.symbol && <span className="text-xs text-blue-600">✓</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-zinc-400">
          More Currencies…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Re-exported for callers that want to read the persisted choice. */
export function getDefaultCurrencySymbol(): string {
  return loadSymbol()
}
