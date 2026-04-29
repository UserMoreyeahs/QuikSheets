'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Plus, Sparkles, Clock, Layers } from 'lucide-react'
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateDefinition } from '@/lib/templates'
import type { Sheet } from '@fortune-sheet/core'

interface SavedWorkbook {
  id: string
  name: string
  savedAt?: string
}

function loadSavedWorkbooks(): SavedWorkbook[] {
  try {
    const workbooks: SavedWorkbook[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('quiksheets_workbook_name:')) {
        const id = key.replace('quiksheets_workbook_name:', '')
        const name = localStorage.getItem(key) ?? `Workbook ${id.slice(0, 8)}`
        workbooks.push({ id, name })
      }
    }
    // Also include the default demo workbook if no others exist
    if (workbooks.length === 0) {
      workbooks.push({ id: '1', name: 'Demo Spreadsheet' })
    }
    return workbooks
  } catch {
    return [{ id: '1', name: 'Demo Spreadsheet' }]
  }
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

function createWorkbookFromTemplate(template: TemplateDefinition, workbookName: string): string {
  const id = `template_${Date.now()}`
  try {
    // Store template sheet data for the sheet page to pick up on load
    const sheetsWithNewId: Sheet[] = template.sheets.map((sheet, index) => ({
      ...sheet,
      id: index === 0 ? 'sheet1' : `sheet${index + 1}`,
      status: index === 0 ? (1 as const) : (0 as const),
      order: index,
    }))
    localStorage.setItem(`quiksheets_template_data:${id}`, JSON.stringify(sheetsWithNewId))
    localStorage.setItem(`quiksheets_workbook_name:${id}`, workbookName)
  } catch {
    // localStorage unavailable; sheet page will show default empty sheet
  }
  return id
}

interface UseTemplateDialogProps {
  template: TemplateDefinition
  onClose: () => void
}

function UseTemplateDialog({ template, onClose }: UseTemplateDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(template.name)

  const handleCreate = () => {
    const id = createWorkbookFromTemplate(template, name.trim() || template.name)
    router.push(`/sheet/${id}`)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[400px] rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Create from template
        </h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {template.description}
        </p>

        <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Workbook name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
          autoFocus
          className="mb-5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create workbook
          </button>
        </div>
      </div>
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  Sales: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Finance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  HR: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Operations: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Project Management': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  Personal: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
}

export default function DashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'workbooks' | 'templates'>('workbooks')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('All')
  const [savedWorkbooks, setSavedWorkbooks] = useState<SavedWorkbook[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null)

  useEffect(() => {
    setSavedWorkbooks(loadSavedWorkbooks())
  }, [])

  const filteredTemplates =
    selectedCategory === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === selectedCategory)

  const handleNewWorkbook = () => {
    const id = `wb_${Date.now()}`
    try {
      localStorage.setItem(`quiksheets_workbook_name:${id}`, 'Untitled Workbook')
    } catch {
      // ignore
    }
    router.push(`/sheet/${id}`)
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Quiksheets</span>
          </div>
          <button
            onClick={handleNewWorkbook}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New workbook
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Tab bar */}
        <div className="mb-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('workbooks')}
            className={[
              'flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'workbooks'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
            ].join(' ')}
          >
            <Layers className="h-4 w-4" />
            My Workbooks
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={[
              'flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'templates'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
            ].join(' ')}
          >
            <Sparkles className="h-4 w-4" />
            Templates
          </button>
        </div>

        {/* My Workbooks */}
        {activeTab === 'workbooks' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Recent workbooks</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {/* New workbook card */}
              <button
                onClick={handleNewWorkbook}
                className="flex h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:text-blue-400"
              >
                <Plus className="h-7 w-7" />
                <span className="text-sm font-medium">New workbook</span>
              </button>

              {savedWorkbooks.map((wb) => (
                <button
                  key={wb.id}
                  onClick={() => router.push(`/sheet/${wb.id}`)}
                  className="group flex h-36 flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="truncate text-sm font-medium text-zinc-800 group-hover:text-blue-700 dark:text-zinc-200 dark:group-hover:text-blue-300">
                      {wb.name}
                    </p>
                    {wb.savedAt && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {formatDate(wb.savedAt)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Templates */}
        {activeTab === 'templates' && (
          <div>
            {/* Category filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:border-blue-300 hover:text-blue-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-600 dark:hover:text-blue-400',
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600"
                >
                  {/* Preview area */}
                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-t-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-850">
                    <div className="w-full px-4 opacity-60">
                      <div className="mb-1 h-4 rounded bg-zinc-300 dark:bg-zinc-600" />
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="mb-1 flex gap-1">
                          <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
                          <div className="h-3 w-1/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                          <div className="h-3 w-1/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          CATEGORY_COLORS[template.category] ?? 'bg-zinc-100 text-zinc-600',
                        ].join(' ')}
                      >
                        {template.category}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {template.rowCount}r × {template.colCount}c
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {template.name}
                    </h3>
                    <p className="mt-0.5 flex-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {template.description}
                    </p>

                    <button
                      onClick={() => setSelectedTemplate(template)}
                      className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-blue-700"
                    >
                      Use template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Use Template Dialog */}
      {selectedTemplate && (
        <UseTemplateDialog
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </main>
  )
}
