export type TriggerType = 'row_created' | 'row_updated' | 'status_changed'

export type ActionType = 'email' | 'whatsapp' | 'slack' | 'teams' | 'task'

export interface TriggerConfig {
  type: TriggerType
  sheetId: string
  /** Column index whose change should fire status_changed. */
  statusColumnIndex?: number
  /** Status value that fires the trigger. */
  statusEquals?: string
}

export interface ActionConfig {
  type: ActionType
  /** Free-form provider config: e.g. recipient email, channel id, message template. */
  config: Record<string, string | number | boolean>
}

export interface AutomationDefinition {
  id?: string
  workbookId: string
  name: string
  enabled: boolean
  trigger: TriggerConfig
  action: ActionConfig
}

export interface TriggerEvent {
  workbookId: string
  sheetId: string
  rowIndex: number
  type: TriggerType
  before?: Record<string, unknown>
  after: Record<string, unknown>
}

export interface ActionResult {
  ok: boolean
  runId?: string
  error?: string
}
