import { describe, it, expect } from 'vitest'

describe('supabase client factories', () => {
  it('getBrowserSupabase returns null when env is missing', async () => {
    // Default test env has no NEXT_PUBLIC_SUPABASE_URL, so factory returns null.
    const { getBrowserSupabase } = await import('@/lib/supabase/client')
    expect(getBrowserSupabase()).toBeNull()
  })

  it('getServiceRoleSupabase returns null when env is missing', async () => {
    const { getServiceRoleSupabase } = await import('@/lib/supabase/server')
    expect(getServiceRoleSupabase()).toBeNull()
  })
})
