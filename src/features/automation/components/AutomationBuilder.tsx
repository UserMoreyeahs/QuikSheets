'use client'

/**
 * AutomationBuilder — create / test automation rules.
 *
 * Step 1: Pick a trigger (row_created / row_updated / status_changed).
 *         For status_changed: specify column index + status value.
 * Step 2: Pick an action + provider (Email / Slack / WhatsApp / Teams / Task).
 *         Configure provider-specific fields (recipient, message, etc.).
 * Step 3: Test Send — fires the automation against a synthetic event and
 *         shows whether the provider call succeeded.
 * Step 4: Save — persists to Supabase via createAutomationAction.
 */

import React, { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useAutomationStore } from '../store/automationStore'
import { createAutomationAction } from '../actions'
import type { ActionType, TriggerType } from '../types'

interface AutomationBuilderProps {
  workbookId: string
  /** Available sheet IDs + names for trigger sheet picker */
  sheets: Array<{ id: string; name: string }>
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  row_created: 'Row created',
  row_updated: 'Row updated',
  status_changed: 'Status / cell changed to value',
}

const ACTION_LABELS: Record<ActionType, string> = {
  email: 'Send email',
  slack: 'Send Slack message',
  teams: 'Send Teams message',
  whatsapp: 'Send WhatsApp message',
  task: 'Create task (internal)',
}

const defaultActionConfig = (type: ActionType): Record<string, string> => {
  switch (type) {
    case 'email':
      return { to: '', subject: 'Automation triggered', body: 'Row updated: {{status}}' }
    case 'slack':
      return { text: 'Row changed — status is now {{status}}' }
    case 'teams':
      return { text: 'Row changed — status is now {{status}}' }
    case 'whatsapp':
      return { to: '', body: 'Row updated: {{status}}' }
    case 'task':
      return { title: 'Follow up: {{status}}' }
  }
}

export function AutomationBuilder({ workbookId, sheets }: AutomationBuilderProps) {
  const { dialogOpen, closeDialog, addAutomation } = useAutomationStore()

  const [name, setName] = useState('New Automation')
  const [triggerType, setTriggerType] = useState<TriggerType>('status_changed')
  const [sheetId, setSheetId] = useState<string>(sheets[0]?.id ?? '')
  const [statusColumnIndex, setStatusColumnIndex] = useState<string>('0')
  const [statusEquals, setStatusEquals] = useState('Overdue')
  const [actionType, setActionType] = useState<ActionType>('slack')
  const [actionConfig, setActionConfig] = useState<Record<string, string>>(
    defaultActionConfig('slack'),
  )
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, startTest] = useTransition()
  const [isSaving, startSave] = useTransition()

  function handleActionTypeChange(next: ActionType) {
    setActionType(next)
    setActionConfig(defaultActionConfig(next))
  }

  function handleConfigChange(key: string, value: string) {
    setActionConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    startSave(async () => {
      const result = await createAutomationAction({
        workbookId,
        name,
        enabled: true,
        trigger: {
          type: triggerType,
          sheetId,
          ...(triggerType === 'status_changed'
            ? {
                statusColumnIndex: Number.parseInt(statusColumnIndex, 10) || 0,
                statusEquals,
              }
            : {}),
        },
        action: {
          type: actionType,
          config: actionConfig,
        },
      })

      if (!result.ok) {
        toast.error(`Failed to save automation: ${result.error}`)
        return
      }

      const newDef = {
        id: result.id,
        workbookId,
        name,
        enabled: true,
        trigger: {
          type: triggerType,
          sheetId,
          ...(triggerType === 'status_changed'
            ? {
                statusColumnIndex: Number.parseInt(statusColumnIndex, 10) || 0,
                statusEquals,
              }
            : {}),
        },
        action: { type: actionType, config: actionConfig },
      }

      addAutomation(newDef)
      toast.success(`Automation "${name}" saved`)
      closeDialog()
    })
  }

  function handleTestSend() {
    setTestResult(null)
    startTest(async () => {
      try {
        const syntheticEvent = {
          workbookId,
          sheetId,
          rowIndex: 1,
          type: triggerType,
          ...(triggerType === 'status_changed'
            ? { before: { [statusColumnIndex]: 'Active' } }
            : {}),
          after: {
            [statusColumnIndex]:
              triggerType === 'status_changed' ? statusEquals : 'test-value',
            status: triggerType === 'status_changed' ? statusEquals : 'test-value',
          },
        }

        const res = await fetch('/api/automation/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syntheticEvent),
        })

        if (res.ok) {
          setTestResult('Test sent! Check the Runs panel for results.')
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: unknown }
          const msg = typeof json.error === 'string' ? json.error : res.statusText
          setTestResult(`Test failed: ${msg}`)
        }
      } catch {
        setTestResult('Test failed: network error')
      }
    })
  }

  const configFields = Object.keys(actionConfig)

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create automation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="automation-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My automation"
            />
          </div>

          {/* Trigger */}
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">Trigger</legend>

            <div className="space-y-1">
              <label htmlFor="trigger-type" className="text-sm font-medium">
                When
              </label>
              <select
                id="trigger-type"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {sheets.length > 0 && (
              <div className="space-y-1">
                <label htmlFor="trigger-sheet" className="text-sm font-medium">
                  On sheet
                </label>
                <select
                  id="trigger-sheet"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {sheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {triggerType === 'status_changed' && (
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label htmlFor="col-idx" className="text-sm font-medium">
                    Column index (0-based)
                  </label>
                  <Input
                    id="col-idx"
                    type="number"
                    min={0}
                    value={statusColumnIndex}
                    onChange={(e) => setStatusColumnIndex(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label htmlFor="status-val" className="text-sm font-medium">
                    Equals value
                  </label>
                  <Input
                    id="status-val"
                    value={statusEquals}
                    onChange={(e) => setStatusEquals(e.target.value)}
                    placeholder="Overdue"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* Action */}
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">Action</legend>

            <div className="space-y-1">
              <label htmlFor="action-type" className="text-sm font-medium">
                Do
              </label>
              <select
                id="action-type"
                value={actionType}
                onChange={(e) => handleActionTypeChange(e.target.value as ActionType)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {configFields.map((key) => (
              <div key={key} className="space-y-1">
                <label htmlFor={`cfg-${key}`} className="text-sm font-medium capitalize">
                  {key}
                </label>
                <Input
                  id={`cfg-${key}`}
                  value={actionConfig[key] ?? ''}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  placeholder={`Enter ${key}`}
                />
              </div>
            ))}
          </fieldset>

          {/* Test result */}
          {testResult && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                testResult.startsWith('Test sent')
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}
            >
              {testResult}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTestSend} disabled={isTesting}>
            {isTesting ? 'Testing…' : 'Test send'}
          </Button>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving…' : 'Save automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
