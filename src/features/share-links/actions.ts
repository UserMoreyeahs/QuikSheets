'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { assertCanManage } from '@/lib/permissions'
import { consumeToken } from '@/lib/rateLimit'

const createSchema = z.object({
  workbookId: z.string().uuid(),
  role: z.enum(['viewer', 'editor']),
  expiresAt: z.string().datetime().optional(),
})

const tokenSchema = z.object({ token: z.string().min(1).max(80) })

/**
 * Generate a cryptographically-secure URL-safe share token.
 *
 * Uses `crypto.randomBytes()` instead of `Math.random()` so an attacker
 * cannot enumerate the token space by predicting the PRNG seed. The
 * base64url alphabet keeps the token URL-safe and roughly the same
 * length as the previous Math.random version (~24 chars).
 *
 * Security review note: 16 bytes = 128 bits of entropy, well above the
 * collision threshold for any realistic number of share links.
 */
function randomToken(byteLength = 16): string {
  return randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export async function createShareLinkAction(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Invalid input' }

  const ctx = await assertCanManage(parsed.data.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }

  const insertPayload: Record<string, unknown> = {
    workbook_id: parsed.data.workbookId,
    token: randomToken(),
    role: parsed.data.role,
    created_by: ctx.userId,
  }
  if (parsed.data.expiresAt) insertPayload.expires_at = parsed.data.expiresAt

  const { data, error } = await supabase
    .from('share_links')
    .insert(insertPayload)
    .select('token')
    .single()

  if (error || !data) return { ok: false as const, error: error?.message ?? 'Insert failed' }

  revalidatePath(`/sheet/${parsed.data.workbookId}`)
  return { ok: true as const, token: data.token as string }
}

export interface ShareLinkResolution {
  ok: boolean
  workbookId?: string
  role?: 'viewer' | 'editor'
  reason?: 'not_found' | 'expired' | 'inactive'
}

export async function resolveShareTokenAction(
  input: z.input<typeof tokenSchema>
): Promise<ShareLinkResolution> {
  const parsed = tokenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'not_found' }

  // Rate-limit token resolution to prevent brute-force enumeration.
  // Bucket keyed by the FIRST 8 chars of the token so the limit
  // applies per-attacker / per-token-prefix rather than globally.
  // Even with the new 128-bit entropy tokens, defence-in-depth keeps
  // a misconfigured client from hammering Supabase.
  const rl = consumeToken(`share-token:${parsed.data.token.slice(0, 8)}`)
  if (!rl.ok) return { ok: false, reason: 'not_found' }

  const service = getServiceRoleSupabase()
  if (!service) return { ok: false, reason: 'not_found' }
  const { data } = await service
    .from('share_links')
    .select('workbook_id, role, expires_at, active')
    .eq('token', parsed.data.token)
    .maybeSingle()
  if (!data) return { ok: false, reason: 'not_found' }
  if (!data.active) return { ok: false, reason: 'inactive' }
  if (data.expires_at) {
    const exp = new Date(String(data.expires_at)).getTime()
    if (Number.isFinite(exp) && exp < Date.now()) return { ok: false, reason: 'expired' }
  }
  return {
    ok: true,
    workbookId: data.workbook_id as string,
    role: data.role as 'viewer' | 'editor',
  }
}

export interface ShareLinkRow {
  id: string
  token: string
  workbookId: string
  role: 'viewer' | 'editor'
  expiresAt: string | null
  active: boolean
  createdAt: string
}

/**
 * List all share links for a workbook.
 * Requires the caller to be the workbook owner.
 */
export async function listShareLinksAction(
  workbookId: string
): Promise<{ ok: true; links: ShareLinkRow[] } | { ok: false; error: string }> {
  const ctx = await assertCanManage(workbookId).catch(() => null)
  if (!ctx) return { ok: false, error: 'Forbidden' }

  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('share_links')
    .select('id, token, workbook_id, role, expires_at, active, created_at')
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: false })

  if (error) return { ok: false, error: error.message }

  const links: ShareLinkRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    token: String(row.token),
    workbookId: String(row.workbook_id),
    role: (row.role === 'editor' ? 'editor' : 'viewer') as 'viewer' | 'editor',
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  }))

  return { ok: true, links }
}

export async function revokeShareLinkAction(input: { workbookId: string; token: string }) {
  const ctx = await assertCanManage(input.workbookId).catch(() => null)
  if (!ctx) return { ok: false as const, error: 'Forbidden' }
  const supabase = await getServerSupabase()
  if (!supabase) return { ok: false as const, error: 'Supabase not configured' }
  const { error } = await supabase
    .from('share_links')
    .update({ active: false })
    .eq('workbook_id', input.workbookId)
    .eq('token', input.token)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/sheet/${input.workbookId}`)
  return { ok: true as const }
}
