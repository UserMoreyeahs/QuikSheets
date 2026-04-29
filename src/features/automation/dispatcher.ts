import { getServiceRoleSupabase } from '@/lib/supabase/server'
import { getProvider } from './providers'
import type { AutomationDefinition, TriggerEvent } from './types'

/**
 * Evaluates whether an automation should fire for a given event, then
 * runs the action and persists the result to automation_runs.
 *
 * Called by the cell-save pipeline after a successful upsert.
 */
export async function dispatchTriggerEvent(event: TriggerEvent): Promise<void> {
  const supabase = getServiceRoleSupabase()
  if (!supabase) return

  const { data: rows } = await supabase
    .from('automations')
    .select('id, name, trigger_type, trigger_config_json, action_type, action_config_json, enabled')
    .eq('workbook_id', event.workbookId)
    .eq('enabled', true)

  if (!rows) return

  for (const row of rows) {
    const automation: AutomationDefinition = {
      id: row.id as string,
      workbookId: event.workbookId,
      name: row.name as string,
      enabled: true,
      trigger: row.trigger_config_json as AutomationDefinition['trigger'],
      action: { type: row.action_type as AutomationDefinition['action']['type'], config: row.action_config_json as AutomationDefinition['action']['config'] },
    }

    if (!shouldFire(automation, event)) continue

    let result
    try {
      const provider = getProvider(automation.action.type)
      result = await provider.send(automation.action.config, event)
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : 'Provider crashed' }
    }

    await supabase.from('automation_runs').insert({
      automation_id: automation.id,
      status: result.ok ? 'success' : 'error',
      input_json: { trigger: automation.trigger, event },
      output_json: result.ok ? { runId: result.runId } : {},
      error_message: result.ok ? null : result.error ?? 'unknown',
    })
  }
}

function shouldFire(automation: AutomationDefinition, event: TriggerEvent): boolean {
  if (automation.trigger.type !== event.type) return false
  if (automation.trigger.sheetId !== event.sheetId) return false

  if (event.type === 'status_changed') {
    const col = automation.trigger.statusColumnIndex
    const expected = automation.trigger.statusEquals
    if (col === undefined || expected === undefined) return false
    const beforeVal = event.before?.[String(col)]
    const afterVal = event.after?.[String(col)]
    return beforeVal !== afterVal && String(afterVal) === expected
  }

  return true
}
