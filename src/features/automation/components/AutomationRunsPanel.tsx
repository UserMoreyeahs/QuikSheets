'use client'

/**
 * AutomationRunsPanel — lists automation_runs for a given workbook's automations.
 *
 * - Shows all automations for the workbook in a native select.
 * - For the selected automation, lists the most recent 50 runs with
 *   status (success / error), timestamp, and error message.
 * - Retry button re-dispatches the original event via retryAutomationRunAction.
 */

import React, { useEffect, useState, useTransition } from 'react'
import { CheckCircle, XCircle, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAutomationStore } from '../store/automationStore'
import { listAutomationsAction, listAutomationRunsAction, retryAutomationRunAction } from '../actions'

interface AutomationRunsProps {
  workbookId: string
}

interface RunRow {
  id: string
  status: string
  error_message: string | null
  created_at: string
}

interface AutomationRow {
  id: string
  name: string
  enabled: boolean
}

export function AutomationRunsPanel({ workbookId }: AutomationRunsProps) {
  const { runsOpen, closeRuns, selectedAutomationId, setSelectedAutomationId } =
    useAutomationStore()

  const [automations, setAutomations] = useState<AutomationRow[]>([])
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [retrying, startRetry] = useTransition()

  // Load automations list when panel opens
  useEffect(() => {
    if (!runsOpen) return
    void listAutomationsAction(workbookId).then((rows) => {
      const mapped: AutomationRow[] = rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        enabled: r.enabled as boolean,
      }))
      setAutomations(mapped)
      // Auto-select first if nothing selected
      if (mapped.length > 0 && !selectedAutomationId) {
        setSelectedAutomationId(mapped[0]!.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runsOpen, workbookId])

  // Load runs when selected automation changes
  useEffect(() => {
    if (!selectedAutomationId) {
      setRuns([])
      return
    }
    setLoadingRuns(true)
    void listAutomationRunsAction(selectedAutomationId).then((rows) => {
      setRuns(
        rows.map((r) => ({
          id: r.id as string,
          status: r.status as string,
          error_message: (r.error_message ?? null) as string | null,
          created_at: r.created_at as string,
        })),
      )
      setLoadingRuns(false)
    })
  }, [selectedAutomationId])

  function handleRetry(runId: string) {
    startRetry(async () => {
      const result = await retryAutomationRunAction(runId)
      if (result.ok) {
        toast.success('Retry dispatched')
        if (selectedAutomationId) {
          const refreshed = await listAutomationRunsAction(selectedAutomationId)
          setRuns(
            refreshed.map((r) => ({
              id: r.id as string,
              status: r.status as string,
              error_message: (r.error_message ?? null) as string | null,
              created_at: r.created_at as string,
            })),
          )
        }
      } else {
        toast.error(`Retry failed: ${result.error}`)
      }
    })
  }

  if (!runsOpen) return null

  return (
    /* Fixed slide-in panel — same pattern as CellHistoryPanel */
    <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h2 className="text-sm font-semibold">Automation runs</h2>
        <button
          type="button"
          onClick={closeRuns}
          aria-label="Close runs panel"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {automations.length === 0 ? (
          <p className="mt-8 text-center text-sm text-zinc-500">
            No automations configured for this workbook.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <label htmlFor="automation-select" className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Automation
              </label>
              <select
                id="automation-select"
                value={selectedAutomationId ?? ''}
                onChange={(e) => setSelectedAutomationId(e.target.value || null)}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {automations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{!a.enabled ? ' (disabled)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {loadingRuns && (
              <p className="text-sm text-zinc-500">Loading runs…</p>
            )}

            {!loadingRuns && runs.length === 0 && selectedAutomationId && (
              <p className="text-sm text-zinc-500">No runs yet for this automation.</p>
            )}

            <ul className="space-y-2">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-700"
                >
                  <div className="mt-0.5 shrink-0">
                    {run.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${
                          run.status === 'success'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        {run.status}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(run.created_at).toLocaleString()}
                      </span>
                    </div>
                    {run.error_message && (
                      <p className="mt-1 truncate text-xs text-red-600 dark:text-red-400">
                        {run.error_message}
                      </p>
                    )}
                  </div>
                  {run.status !== 'success' && (
                    <button
                      type="button"
                      onClick={() => handleRetry(run.id)}
                      disabled={retrying}
                      title="Retry this run"
                      className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
