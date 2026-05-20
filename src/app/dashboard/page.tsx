'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Plus, Sparkles, Clock, Layers, Trash2, Search, ArrowDownUp } from 'lucide-react'
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateDefinition } from '@/lib/templates'
import type { Sheet } from '@fortune-sheet/core'
import { useDashboardWorkbooks, type DashboardWorkbook } from '@/features/workbook/useDashboardWorkbooks'
import { createWorkbookAction, deleteWorkbookAction } from '@/features/workbook/actions'
import { getBrowserSupabase } from '@/lib/supabase/client'

function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

async function pickPrimaryWorkspaceId(): Promise<string | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null

  // Race the Supabase query against a 5-second timeout so the "New
  // workbook" button never hangs when the backend is unreachable.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000))

  const query = (async (): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return (data?.workspace_id as string | undefined) ?? null
  })()

  return Promise.race([query, timeout])
}

function createLocalWorkbookFromTemplate(template: TemplateDefinition, workbookName: string): string {
  const id = `template_${Date.now()}`
  try {
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
  hasAuth: boolean
  onClose: () => void
}

function UseTemplateDialog({ template, hasAuth, onClose }: UseTemplateDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(template.name)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleCreate = () => {
    setError(null)
    const finalName = name.trim() || template.name

    if (!hasAuth) {
      const id = createLocalWorkbookFromTemplate(template, finalName)
      router.push(`/sheet/${id}`)
      return
    }

    startTransition(async () => {
      const workspaceId = await pickPrimaryWorkspaceId()
      if (!workspaceId) {
        const id = createLocalWorkbookFromTemplate(template, finalName)
        router.push(`/sheet/${id}`)
        return
      }
      const result = await createWorkbookAction({ name: finalName, workspaceId })
      if (!result.ok || !result.id) {
        setError(result.error ?? 'Failed to create workbook')
        return
      }
      // Stash the template payload locally for the sheet page to hydrate from.
      try {
        const sheetsWithNewId: Sheet[] = template.sheets.map((sheet, index) => ({
          ...sheet,
          id: index === 0 ? 'sheet1' : `sheet${index + 1}`,
          status: index === 0 ? (1 as const) : (0 as const),
          order: index,
        }))
        localStorage.setItem(
          `quiksheets_template_data:${result.id}`,
          JSON.stringify(sheetsWithNewId)
        )
      } catch {
        // ignore
      }
      router.push(`/sheet/${result.id}`)
    })
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
            if (e.key === 'Escape') onClose()
          }}
          autoFocus
          className="mb-5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create workbook'}
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
  // UX-4: search + sort over the workbooks grid. Sort defaults to
  // 'recent' (last updated) which matches Google Sheets / Excel Online.
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'created'>('recent')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('All')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null)
  const [pending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<DashboardWorkbook | null>(null)
  const [deletePending, startDeleteTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { workbooks, isLoading, hasAuth, refreshLocal, refreshRemote } = useDashboardWorkbooks()

  const performDelete = (wb: DashboardWorkbook) => {
    setDeleteError(null)
    startDeleteTransition(async () => {
      if (wb.source === 'supabase') {
        const result = await deleteWorkbookAction({ id: wb.id })
        if (!result.ok) {
          setDeleteError(result.error ?? 'Delete failed')
          return
        }
        refreshRemote()
      } else {
        try {
          localStorage.removeItem(`quiksheets_workbook_name:${wb.id}`)
          localStorage.removeItem(`quiksheets_template_data:${wb.id}`)
          localStorage.removeItem(`quiksheets_workbook_${wb.name}`)
          localStorage.removeItem(`quiksheets_cf_rules:${wb.id}`)
          localStorage.removeItem(`quiksheets_scratchpad:${wb.id}`)
        } catch {
          // ignore
        }
        refreshLocal()
      }
      setDeleteTarget(null)
    })
  }

  const filteredTemplates =
    selectedCategory === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === selectedCategory)

  const handleNewWorkbook = () => {
    if (!hasAuth) {
      const id = `wb_${Date.now()}`
      try {
        localStorage.setItem(`quiksheets_workbook_name:${id}`, 'Untitled Workbook')
      } catch {
        // ignore
      }
      router.push(`/sheet/${id}`)
      return
    }

    startTransition(async () => {
      const workspaceId = await pickPrimaryWorkspaceId()
      if (!workspaceId) {
        const id = `wb_${Date.now()}`
        try {
          localStorage.setItem(`quiksheets_workbook_name:${id}`, 'Untitled Workbook')
        } catch {
          // ignore
        }
        router.push(`/sheet/${id}`)
        return
      }
      const result = await createWorkbookAction({
        name: 'Untitled Workbook',
        workspaceId,
      })
      if (result.ok && result.id) {
        router.push(`/sheet/${result.id}`)
      } else {
        const id = `wb_${Date.now()}`
        try {
          localStorage.setItem(`quiksheets_workbook_name:${id}`, 'Untitled Workbook')
        } catch {
          // ignore
        }
        router.push(`/sheet/${id}`)
      }
    })
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
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {pending ? 'Creating…' : 'New workbook'}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                {searchQuery ? `Workbooks matching "${searchQuery}"` : 'Recent workbooks'}
              </h2>
              {!hasAuth ? (
                <p className="text-xs text-zinc-500">Sign in to sync workbooks across devices.</p>
              ) : null}
            </div>

            {/* UX-4: search + sort row */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workbooks by name…"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                <ArrowDownUp className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="h-9 bg-transparent text-xs text-zinc-700 outline-none dark:text-zinc-200"
                  aria-label="Sort workbooks"
                >
                  <option value="recent">Last opened</option>
                  <option value="name">Name (A → Z)</option>
                  <option value="created">Date created</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {/* New workbook card */}
              <button
                onClick={handleNewWorkbook}
                disabled={pending}
                className="flex h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-blue-400 hover:text-blue-500 disabled:opacity-60 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:text-blue-400"
              >
                <Plus className="h-7 w-7" />
                <span className="text-sm font-medium">New workbook</span>
              </button>

              {isLoading && workbooks.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-500">Loading workbooks…</p>
              ) : (
                workbooks
                  .filter((wb) => !searchQuery || wb.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (sortBy === 'name') return a.name.localeCompare(b.name)
                    // 'created' falls back to updatedAt — DashboardWorkbook
                    // doesn't currently track a separate created timestamp.
                    const aTime = a.updatedAt
                    const bTime = b.updatedAt
                    return (bTime ? new Date(bTime).getTime() : 0) - (aTime ? new Date(aTime).getTime() : 0)
                  })
                  .map((wb) => (
                  <div
                    key={wb.id}
                    onClick={() => router.push(`/sheet/${wb.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/sheet/${wb.id}`)
                      }
                    }}
                    className="group relative flex h-36 cursor-pointer flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600"
                  >
                    <button
                      type="button"
                      aria-label={`Delete ${wb.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(wb)
                      }}
                      className="absolute right-2 top-2 rounded-md p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      {wb.source === 'local' ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                          Local
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="truncate text-sm font-medium text-zinc-800 group-hover:text-blue-700 dark:text-zinc-200 dark:group-hover:text-blue-300">
                        {wb.name}
                      </p>
                      {wb.updatedAt && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                          <Clock className="h-3 w-3" />
                          {formatDate(wb.updatedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
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
          hasAuth={hasAuth}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-workbook-title"
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (!deletePending) {
              setDeleteTarget(null)
              setDeleteError(null)
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 id="delete-workbook-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Delete workbook?
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  &ldquo;<span className="font-medium text-zinc-700 dark:text-zinc-200">{deleteTarget.name}</span>&rdquo; will be permanently deleted
                  {deleteTarget.source === 'supabase' ? ' from your Supabase workspace' : ' from this browser'}. This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError ? (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteError(null)
                }}
                disabled={deletePending}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performDelete(deleteTarget)}
                disabled={deletePending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deletePending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
