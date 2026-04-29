import type { Provider } from './types'
import type { ActionResult, TriggerEvent } from '../types'

/**
 * Stand-in provider used whenever real credentials are absent. Always
 * returns ok:true and writes a row to automation_runs; useful for dev
 * and demo flows.
 */
export class MockProvider implements Provider {
  readonly name: string

  constructor(name: string) {
    this.name = `mock:${name}`
  }

  async send(_config: Record<string, unknown>, event: TriggerEvent): Promise<ActionResult> {
    return { ok: true, runId: `mock-${event.type}-${Date.now()}` }
  }
}
