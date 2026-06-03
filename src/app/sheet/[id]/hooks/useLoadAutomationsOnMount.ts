'use client'

import { useEffect } from 'react'
import { listAutomationsAction } from '@/features/automation/actions'
import { useAutomationStore } from '@/features/automation/store/automationStore'
import type { TriggerConfig, ActionType } from '@/features/automation/types'

/**
 * Pre-load enabled automations for this workbook into the automation
 * store so the grid trigger wiring can evaluate conditions without a
 * per-keystroke Supabase round-trip.
 *
 * Skips when the workbook is the 'demo' workbook (no Supabase row to
 * fetch) or workbookId is empty.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useLoadAutomationsOnMount(workbookId: string): void {
  const setAutomations = useAutomationStore((s) => s.setAutomations)

  useEffect(() => {
    if (!workbookId || workbookId === 'demo') return
    void listAutomationsAction(workbookId).then((rows) => {
      setAutomations(
        rows
          .filter((r) => r.enabled)
          .map((r) => ({
            id: r.id as string,
            workbookId,
            name: r.name as string,
            enabled: true,
            trigger: r.trigger_config_json as TriggerConfig,
            action: {
              type: r.action_type as ActionType,
              config: r.action_config_json as Record<string, string | number | boolean>,
            },
          })),
      )
    })
  }, [workbookId, setAutomations])
}
