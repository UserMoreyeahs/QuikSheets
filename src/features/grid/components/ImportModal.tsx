'use client'

import React, { useRef, useState } from 'react'
import { importFile, getImportPreview, ACCEPTED_FILE_TYPES } from '../utils/importUtils'
import type { ImportedSheet } from '../utils/importUtils'
import { cn } from '@/lib/utils'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (sheets: ImportedSheet[]) => void
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [importedSheets, setImportedSheets] = useState<ImportedSheet[]>([])
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const selectedSheet = importedSheets[selectedSheetIndex]
  const preview = selectedSheet ? getImportPreview(selectedSheet) : []

  async function handleFile(file: File) {
    setIsLoading(true)
    setError(null)
    const result = await importFile(file)
    setIsLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setImportedSheets(result.sheets)
    setFileName(result.fileName)
    setSelectedSheetIndex(0)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  function handleConfirmImport() {
    onImport(importedSheets)
    onClose()
    setImportedSheets([])
    setFileName('')
    setError(null)
  }

  function handleReset() {
    setImportedSheets([])
    setFileName('')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="flex max-h-[80vh] w-[640px] flex-col rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Import File</h2>
            <p className="text-xs text-zinc-400">Supports .xlsx .xls .csv .tsv .ods</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 transition-colors hover:text-zinc-600">
            x
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {importedSheets.length === 0 && !isLoading && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-colors',
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
              )}
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Upload</div>
              <p className="text-sm font-medium text-zinc-700">Drop your file here</p>
              <p className="mt-1 text-xs text-zinc-400">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="ml-3 text-sm text-zinc-500">Reading file...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-2 text-xs text-red-500 transition-colors hover:text-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {importedSheets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{fileName}</p>
                  <p className="text-xs text-zinc-400">{importedSheets.length} sheet(s) detected</p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-zinc-400 transition-colors hover:text-zinc-600"
                >
                  Change file
                </button>
              </div>

              {importedSheets.length > 1 && (
                <div className="flex gap-1 overflow-x-auto">
                  {importedSheets.map((sheet, index) => (
                    <button
                      key={sheet.name}
                      type="button"
                      onClick={() => setSelectedSheetIndex(index)}
                      className={cn(
                        'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        index === selectedSheetIndex
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      )}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        {(preview[0] ?? []).map((_, colIndex) => (
                          <th key={colIndex} className="px-3 py-2 text-left font-medium text-zinc-500">
                            {String.fromCharCode(65 + colIndex)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={cn('border-b border-zinc-100', rowIndex === 0 && 'bg-blue-50 font-medium')}
                        >
                          {row.map((cell, colIndex) => (
                            <td key={colIndex} className="max-w-[150px] truncate px-3 py-1.5 text-zinc-700">
                              {cell !== null ? String(cell) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedSheet && selectedSheet.data.length > 10 && (
                  <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-center">
                    <span className="text-[10px] text-zinc-400">
                      Showing first 10 of {selectedSheet.data.length} rows
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={importedSheets.length === 0}
            className={cn(
              'rounded-lg px-4 py-2 text-xs text-white transition-colors',
              importedSheets.length > 0
                ? 'bg-zinc-900 hover:bg-zinc-700'
                : 'cursor-not-allowed bg-zinc-300'
            )}
          >
            Import{importedSheets.length > 0 ? ` ${importedSheets.length} sheet(s)` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
