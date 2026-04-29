'use client'

import React, { useEffect, useRef, useState } from 'react'
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils'
import type { ExportSheet } from '../utils/exportUtils'
import { cn } from '@/lib/utils'

interface ExportMenuProps {
  workbookName: string
  getActiveSheetData: () => ExportSheet
  getAllSheetsData: () => ExportSheet[]
}

const EXPORT_OPTIONS = [
  {
    type: 'xlsx' as const,
    label: 'Microsoft Excel (.xlsx)',
    description: 'All sheets included',
    badge: 'XLSX',
  },
  {
    type: 'csv' as const,
    label: 'CSV (.csv)',
    description: 'Active sheet only',
    badge: 'CSV',
  },
  {
    type: 'pdf' as const,
    label: 'PDF (.pdf)',
    description: 'Active sheet, print-ready',
    badge: 'PDF',
  },
]

function logExportError(err: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    const consoleRef = Reflect.get(globalThis, 'console') as
      | { error?: (message: string, value: unknown) => void }
      | null
    consoleRef?.error?.('Export failed:', err)
  }
}

export function ExportMenu({ workbookName, getActiveSheetData, getAllSheetsData }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleExport(type: 'xlsx' | 'csv' | 'pdf') {
    setIsExporting(true)
    setIsOpen(false)

    try {
      // Let the loading state paint before the synchronous export work starts.
      await new Promise<void>((resolve) => setTimeout(resolve, 100))

      if (type === 'xlsx') {
        exportToExcel(getAllSheetsData(), workbookName)
      } else if (type === 'csv') {
        exportToCSV(getActiveSheetData(), workbookName)
      } else {
        exportToPDF(getActiveSheetData(), workbookName)
      }
    } catch (err) {
      logExportError(err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isExporting}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-zinc-200',
          'px-3 py-1.5 text-xs text-zinc-600 transition-colors',
          'hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
        )}
      >
        {isExporting ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
            Exporting...
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[240px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
          <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-700">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Export As</p>
          </div>
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => void handleExport(option.type)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              <span className="min-w-10 text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                {option.badge}
              </span>
              <div>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100">{option.label}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
