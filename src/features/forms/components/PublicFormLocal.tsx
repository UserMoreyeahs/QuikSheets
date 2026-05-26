'use client'

/**
 * PublicFormLocal
 * --------------------------------------------------------------------------
 * localStorage-backed twin of PublicFormClient.  Reads the form definition
 * from `quiksheets_form:<id>` and writes submissions to
 * `quiksheets_form_submissions:<id>` — those are then merged into the source
 * workbook on next sheet-page mount.
 */

import { useEffect, useState, useTransition } from 'react'
import { getForm, appendSubmission } from '@/features/forms/storage/localFormStore'
import type { FormDefinition } from '@/features/forms/types'

export function PublicFormLocal({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDefinition | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const stored = getForm(formId)
    setForm(stored)
    setLoaded(true)
  }, [formId])

  if (!loaded) {
    return (
      <div className="text-center text-sm text-zinc-500">Loading…</div>
    )
  }

  if (!form) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700">
        This form does not exist or has been deleted.
      </div>
    )
  }

  if (!form.isPublic) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-700">
        This form is not public.
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900">{form.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">Powered by Quiksheets</p>

      {success ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Thanks — your response was recorded.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formEl = e.currentTarget
            const data = new FormData(formEl)
            const honeypot = String(data.get('hp_field') ?? '')
            if (honeypot.length > 0) {
              // bot — silently succeed, do not record.
              setSuccess(true)
              return
            }
            const values: Record<string, string | number | boolean> = {}
            for (const field of form.fields) {
              const raw = data.get(field.id)
              if (field.kind === 'number' || field.kind === 'currency') values[field.id] = Number(raw ?? 0)
              else if (field.kind === 'checkbox') values[field.id] = data.get(field.id) === 'on'
              else values[field.id] = String(raw ?? '')
            }
            // basic required-field validation
            for (const field of form.fields) {
              if (field.required && (values[field.id] === '' || values[field.id] === undefined)) {
                setError(`Please fill in "${field.label}".`)
                return
              }
            }
            setError(null)
            startTransition(async () => {
              try {
                appendSubmission(form.id ?? formId, { formId: form.id ?? formId, values })
                setSuccess(true)
              } catch {
                setError('Submission failed. Please try again.')
              }
            })
          }}
          className="space-y-4"
        >
          {/* honeypot */}
          <input type="text" name="hp_field" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          {form.fields.map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="mb-1 block text-sm font-medium text-zinc-700">
                {field.label}
                {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
              </label>
              {field.kind === 'select' || field.kind === 'status' ? (
                <select
                  id={field.id}
                  name={field.id}
                  required={field.required}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.kind === 'checkbox' ? (
                <input id={field.id} name={field.id} type="checkbox" className="h-4 w-4" />
              ) : (
                <input
                  id={field.id}
                  name={field.id}
                  type={
                    field.kind === 'number' || field.kind === 'currency'
                      ? 'number'
                      : field.kind === 'email'
                      ? 'email'
                      : field.kind === 'date'
                      ? 'date'
                      : 'text'
                  }
                  required={field.required}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              )}
              {field.helpText ? <p className="mt-1 text-xs text-zinc-500">{field.helpText}</p> : null}
            </div>
          ))}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      )}
    </div>
  )
}
