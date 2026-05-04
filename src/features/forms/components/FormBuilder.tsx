'use client'

/**
 * FormBuilder
 * --------------------------------------------------------------------------
 * Modal that turns the active sheet's first row into a public form schema.
 *
 *   1. Reads the header row of the active sheet.
 *   2. Infers a sensible field kind for each header (email / number / date / …).
 *   3. Lets the user toggle which fields are included, set required-ness,
 *      and rename labels.
 *   4. Saves the form definition to localStorage and shows the public
 *      /form/[id] URL (copyable + opens in new tab).
 *
 * The public form route reads the same localStorage key on submit and
 * pushes one row of values into the form's submission queue — submissions
 * are then merged back into the sheet on next page mount.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ExternalLink, Copy, Plus, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { useFormBuilderStore } from '@/features/forms/store/formBuilderStore'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { saveForm, listFormsForWorkbook, deleteForm } from '@/features/forms/storage/localFormStore'
import { buildFieldsFromHeaders, generateSlug } from '@/features/forms/utils/formBuilder'
import { getSheetMatrix, getCellDisplayValue } from '@/lib/fortuneSheet'
import type { FormField, FormFieldKind } from '@/features/forms/types'
import { cn } from '@/lib/utils'

const FIELD_KINDS: FormFieldKind[] = [
  'text', 'email', 'number', 'currency', 'date', 'select', 'status', 'checkbox',
]

export function FormBuilder({ workbookId }: { workbookId: string }) {
  const open = useFormBuilderStore((s) => s.isOpen)
  const close = useFormBuilderStore((s) => s.close)

  const { gridSheets } = useSheetStore()
  const { activeSheetId } = useWorkbookStore()
  const activeSheet = useMemo(() => gridSheets.find((s) => s.status === 1) ?? gridSheets[0], [gridSheets])

  const [name, setName] = useState('Untitled form')
  const [fields, setFields] = useState<FormField[]>([])
  const [savedFormId, setSavedFormId] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [existingForms, setExistingForms] = useState<ReturnType<typeof listFormsForWorkbook>>([])

  // refresh existing forms when modal opens
  useEffect(() => {
    if (!open) return
    setExistingForms(listFormsForWorkbook(workbookId))
    setSavedFormId(null)
    setSavedSlug(null)

    if (!activeSheet) return
    const matrix = getSheetMatrix(activeSheet)
    const headerRow = matrix[0] ?? []
    const headers = headerRow.map((cell, idx) => {
      const display = getCellDisplayValue(cell)
      return { index: idx, label: display === null || display === undefined ? '' : String(display) }
    }).filter((h) => h.label.trim().length > 0)
    setFields(buildFieldsFromHeaders(headers))
    setName('Form from active sheet')
  }, [open, workbookId, activeSheet])

  // ── drag-drop reorder (hooks must be before early return) ──────────
  const dragFromRef = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  if (!open) return null

  function updateField(idx: number, patch: Partial<FormField>) {
    setFields((cur) => cur.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  function removeField(idx: number) {
    setFields((cur) => cur.filter((_, i) => i !== idx))
  }

  function moveField(from: number, to: number) {
    if (from === to) return
    setFields((cur) => {
      const next = [...cur]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      return next
    })
  }

  function addCustomField() {
    setFields((cur) => [
      ...cur,
      {
        id: crypto.randomUUID(),
        label: 'New field',
        columnIndex: cur.length,
        kind: 'text',
        required: false,
      },
    ])
  }

  function save() {
    if (fields.length === 0) {
      toast.error('Add at least one field.')
      return
    }
    if (!name.trim()) {
      toast.error('Name your form.')
      return
    }
    if (!activeSheetId) {
      toast.error('No active sheet.')
      return
    }
    const slug = generateSlug(name)
    const stored = saveForm({
      workbookId,
      sheetId: activeSheetId,
      name: name.trim(),
      slug,
      isPublic: true,
      fields,
    })
    setSavedFormId(stored.id)
    setSavedSlug(stored.slug)
    setExistingForms(listFormsForWorkbook(workbookId))
    toast.success('Form saved.')
  }

  function publicUrl(id: string): string {
    if (typeof window === 'undefined') return `/form/${id}`
    return `${window.location.origin}/form/${id}`
  }

  function copyUrl(id: string) {
    const url = publicUrl(id)
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied.'),
      () => toast.error('Could not copy link.')
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create Form from Sheet</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[1fr,260px] gap-6">
            {/* left — fields */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Form name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Fields ({fields.length})
                  </span>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    <Plus className="h-3 w-3" /> Add field
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-300 px-3 py-8 text-center text-[12px] text-zinc-400 dark:border-zinc-700">
                    No headers detected in row 1 of the active sheet. Click <em>Add field</em> to build one manually.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, i) => (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={() => { dragFromRef.current = i }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i) }}
                        onDragLeave={() => setDragOverIdx((cur) => cur === i ? null : cur)}
                        onDrop={(e) => {
                          e.preventDefault()
                          const from = dragFromRef.current
                          dragFromRef.current = null
                          setDragOverIdx(null)
                          if (from === null || from === i) return
                          moveField(from, i)
                        }}
                        onDragEnd={() => { dragFromRef.current = null; setDragOverIdx(null) }}
                        className={`grid grid-cols-[18px,1fr,90px,80px,28px] items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                          dragOverIdx === i
                            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
                            : 'border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        <span aria-label="Drag to reorder" className="flex cursor-grab items-center justify-center text-zinc-400 hover:text-zinc-700 active:cursor-grabbing dark:hover:text-zinc-200">
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <input
                          value={field.label}
                          onChange={(e) => updateField(i, { label: e.target.value })}
                          className="rounded-sm bg-transparent px-1 text-[13px] outline-none focus:bg-blue-50 dark:focus:bg-blue-900/30"
                          placeholder="Label"
                        />
                        <select
                          value={field.kind}
                          onChange={(e) => updateField(i, { kind: e.target.value as FormFieldKind })}
                          className="rounded-sm border border-zinc-200 bg-white px-1 py-0.5 text-[11px] dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          {FIELD_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(i, { required: e.target.checked })}
                            className="h-3 w-3"
                          />
                          required
                        </label>
                        <button
                          type="button"
                          onClick={() => removeField(i)}
                          aria-label="Remove field"
                          className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* right — saved + existing */}
            <div className="space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
              {savedFormId && savedSlug && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/30">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Form saved
                  </div>
                  <div className="mt-1 break-all font-mono text-[10px] text-emerald-800 dark:text-emerald-200">
                    {publicUrl(savedFormId)}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => copyUrl(savedFormId)}
                      className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                    >
                      <Copy className="h-3 w-3" /> Copy link
                    </button>
                    <a
                      href={publicUrl(savedFormId)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-1 rounded border border-emerald-600 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Existing forms
                </div>
                {existingForms.length === 0 ? (
                  <div className="text-[11px] italic text-zinc-400">No forms yet for this workbook.</div>
                ) : (
                  <ul className="space-y-1">
                    {existingForms.map((f) => (
                      <li key={f.id} className="group flex items-center justify-between rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        <a
                          href={publicUrl(f.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 truncate text-[12px] text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {f.name}
                        </a>
                        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => copyUrl(f.id)}
                            aria-label="Copy link"
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete form "${f.name}"?`)) {
                                deleteForm(f.id)
                                setExistingForms(listFormsForWorkbook(workbookId))
                                if (savedFormId === f.id) {
                                  setSavedFormId(null)
                                  setSavedSlug(null)
                                }
                                toast.success('Form deleted.')
                              }
                            }}
                            aria-label="Delete form"
                            className="rounded p-1 text-zinc-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className={cn('flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700')}>
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            type="button"
            onClick={save}
            disabled={fields.length === 0 || !name.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savedFormId ? 'Save again' : 'Save & generate link'}
          </button>
        </div>
      </div>
    </div>
  )
}
