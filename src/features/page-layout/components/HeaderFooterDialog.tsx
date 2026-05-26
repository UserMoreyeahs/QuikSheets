'use client'

/**
 * HeaderFooterDialog — Insert > Text > Header & Footer (also reachable
 * from Page Layout > Header & Footer).
 *
 * Mirrors Excel's "Page Setup > Header/Footer" tab. Two sections (Header,
 * Footer), each with Left / Center / Right text fields. Clicking a token
 * chip inserts the literal at the cursor of the most recently focused
 * input. A live preview row at the top shows how page 1 of N will render.
 *
 * The 6 fields persist in the print-settings store and are rendered on
 * every page of the PDF export via a jspdf-autotable didDrawPage hook.
 */

import { useRef } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { usePrintSettingsStore } from '../printSettingsStore'
import { useHeaderFooterDialogStore } from '../store/headerFooterDialogStore'
import {
  HEADER_FOOTER_TOKENS,
  substituteHeaderFooterTokens,
} from '../utils/headerFooterTokens'

export function HeaderFooterDialog() {
  const open = useHeaderFooterDialogStore((s) => s.open)
  const close = useHeaderFooterDialogStore((s) => s.closeDialog)
  const headerFooter = usePrintSettingsStore((s) => s.headerFooter)
  const setHeaderFooter = usePrintSettingsStore((s) => s.setHeaderFooter)
  const clearHeaderFooter = usePrintSettingsStore((s) => s.clearHeaderFooter)

  // Track the last input the user typed in so token chips know where to
  // insert. Defaults to headerCenter if nothing has been focused yet.
  const lastFocusedRef = useRef<keyof typeof headerFooter>('headerCenter')

  function insertToken(token: string) {
    const field = lastFocusedRef.current
    const current = headerFooter[field] ?? ''
    setHeaderFooter({ [field]: current + token })
  }

  // Live preview uses page=1 of 1 placeholder — at export time we
  // recompute with the real page/pages numbers per page.
  const previewCtx = {
    page: 1,
    pages: 1,
    sheet: 'Sheet1',
    file: 'Workbook',
  }
  const previewRow = (left: string, center: string, right: string) => (
    <div className="grid grid-cols-3 items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-800/50">
      <span className="truncate text-left">{substituteHeaderFooterTokens(left, previewCtx) || <em className="text-zinc-400">left</em>}</span>
      <span className="truncate text-center">{substituteHeaderFooterTokens(center, previewCtx) || <em className="text-zinc-400">center</em>}</span>
      <span className="truncate text-right">{substituteHeaderFooterTokens(right, previewCtx) || <em className="text-zinc-400">right</em>}</span>
    </div>
  )

  function field(name: keyof typeof headerFooter, placeholder: string) {
    return (
      <input
        type="text"
        value={headerFooter[name]}
        placeholder={placeholder}
        onChange={(e) => setHeaderFooter({ [name]: e.target.value })}
        onFocus={() => { lastFocusedRef.current = name }}
        className="h-8 w-full rounded border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Page Header &amp; Footer</DialogTitle>
          <DialogDescription>
            Set page header and footer text for PDF export. Use the token
            chips to insert page numbers, dates, or the sheet name.
          </DialogDescription>
        </DialogHeader>

        {/* Token chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">Tokens</span>
          {HEADER_FOOTER_TOKENS.map((t) => (
            <button
              key={t.token}
              type="button"
              onClick={() => insertToken(t.token)}
              title={`Insert ${t.token}`}
              className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="grid gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Preview (page 1)</div>
          {previewRow(headerFooter.headerLeft, headerFooter.headerCenter, headerFooter.headerRight)}
          <div className="rounded border border-dashed border-zinc-200 px-3 py-2 text-center text-[11px] italic text-zinc-400 dark:border-zinc-700">
            …workbook content…
          </div>
          {previewRow(headerFooter.footerLeft, headerFooter.footerCenter, headerFooter.footerRight)}
        </div>

        {/* Editor */}
        <div className="grid gap-3 pt-1">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Header</div>
            <div className="grid grid-cols-3 gap-2">
              {field('headerLeft',   'Left')}
              {field('headerCenter', 'Center')}
              {field('headerRight',  'Right')}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Footer</div>
            <div className="grid grid-cols-3 gap-2">
              {field('footerLeft',   'Left')}
              {field('footerCenter', 'Center')}
              {field('footerRight',  'Right')}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button
            type="button"
            onClick={() => { clearHeaderFooter(); toast.message('Header & footer cleared') }}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => { close(); toast.success('Header & footer saved') }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
