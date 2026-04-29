import type { ActionConfig, ActionResult, TriggerEvent } from '../types'

export interface Provider {
  readonly name: string
  send(config: ActionConfig['config'], event: TriggerEvent): Promise<ActionResult>
}
