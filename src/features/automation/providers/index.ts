import { serverEnv } from '@/lib/env'
import { MockProvider } from './MockProvider'
import type { Provider } from './types'
import type { ActionType } from '../types'

/**
 * Provider registry. When real provider env vars are set (e.g.
 * SLACK_PROVIDER=real with SLACK_BOT_TOKEN), the registry will hand back
 * a real adapter; otherwise it returns a MockProvider that succeeds
 * silently. Real adapter implementations land in follow-up R10.x.
 */
export function getProvider(type: ActionType): Provider {
  switch (type) {
    case 'email':
      return serverEnv.EMAIL_PROVIDER === 'mock'
        ? new MockProvider('email')
        : new MockProvider('email') // TODO(R10.x): real email adapter
    case 'slack':
      return serverEnv.SLACK_PROVIDER === 'mock'
        ? new MockProvider('slack')
        : new MockProvider('slack')
    case 'teams':
      return serverEnv.TEAMS_PROVIDER === 'mock'
        ? new MockProvider('teams')
        : new MockProvider('teams')
    case 'whatsapp':
      return serverEnv.WHATSAPP_PROVIDER === 'mock'
        ? new MockProvider('whatsapp')
        : new MockProvider('whatsapp')
    case 'task':
      return serverEnv.TASK_PROVIDER === 'mock'
        ? new MockProvider('task')
        : new MockProvider('task')
  }
}
