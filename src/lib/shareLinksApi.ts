'use client'

/**
 * shareLinksApi
 * =============================================================================
 * Supabase-first client-side API for share links, with automatic localStorage
 * fallback for standalone / unauthenticated mode.  One-time per-workbook
 * migration from the legacy `sheetforge_share_links:<id>` localStorage keys to
 * the Supabase `share_links` table is triggered on the first createLink call.
 *
 * Column layout expected in Supabase:
 *   id uuid pk, token text unique, workbook_id uuid, role text,
 *   expires_at timestamptz null, active boolean default true,
 *   created_by uuid, created_at timestamptz
 *
 * Never read SUPABASE_SERVICE_ROLE_KEY here — this file is client-side.
 * Token resolution that requires service-role access lives in actions.ts.
 */

import { getBrowserSupabase } from '@/lib/supabase/client'
import {
  createLocalShareLink,
  listLocalShareLinks,
  revokeLocalShareLink,
  resolveLocalShareToken,
  type LocalShareLink,
} from '@/features/share-links/storage/localShareLinks'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareLink {
  id: string
  token: string
  workbookId: string
  role: 'viewer' | 'editor'
  expiresAt: number | null   // ms epoch, null = never
  active: boolean
  createdAt: number          // ms epoch
}

export interface CreateLinkInput {
  workbookId: string
  role: 'viewer' | 'editor'
  /** Unix epoch ms — null means no expiry */
  expiresAt?: number | null
}

export interface ResolveResult {
  ok: boolean
  workbookId?: string
  role?: 'viewer' | 'editor'
  reason?: 'not_found' | 'expired' | 'inactive'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIGRATED_FLAG = (workbookId: string) =>
  `quiksheets_share_links_migrated:${workbookId}`

function localToShareLink(l: LocalShareLink): ShareLink {
  return {
    id: l.token,           // localStorage has no separate id — use token
    token: l.token,
    workbookId: l.workbookId,
    role: l.role,
    expiresAt: l.expiresAt,
    active: l.active,
    createdAt: l.createdAt,
  }
}

/** Convert a raw Supabase row into ShareLink. */
function rowToShareLink(row: Record<string, unknown>): ShareLink {
  const expiresAtRaw = row['expires_at']
  const expiresAt =
    expiresAtRaw && typeof expiresAtRaw === 'string'
      ? new Date(expiresAtRaw).getTime()
      : null
  const createdAtRaw = row['created_at']
  const createdAt =
    createdAtRaw && typeof createdAtRaw === 'string'
      ? new Date(createdAtRaw).getTime()
      : Date.now()
  return {
    id: String(row['id'] ?? ''),
    token: String(row['token'] ?? ''),
    workbookId: String(row['workbook_id'] ?? ''),
    role: (row['role'] === 'editor' ? 'editor' : 'viewer') as 'viewer' | 'editor',
    expiresAt: expiresAt !== null && Number.isFinite(expiresAt) ? expiresAt : null,
    active: Boolean(row['active'] ?? true),
    createdAt,
  }
}

// ─── One-time migration: localStorage → Supabase ─────────────────────────────

/**
 * On the first successful Supabase write for a workbook, migrate any
 * existing localStorage links for the same workbook into Supabase so the
 * owner sees all their links in one place.  Runs at most once per workbook
 * per browser (tracked with a localStorage flag).
 */
async function migrateLocalLinksOnce(workbookId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const flag = MIGRATED_FLAG(workbookId)
  if (localStorage.getItem(flag) === 'done') return

  const supabase = getBrowserSupabase()
  if (!supabase) return

  const localLinks = listLocalShareLinks(workbookId).filter((l) => l.active)
  if (localLinks.length === 0) {
    localStorage.setItem(flag, 'done')
    return
  }

  const rows = localLinks.map((l) => ({
    token: l.token,
    workbook_id: l.workbookId,
    role: l.role,
    expires_at: l.expiresAt ? new Date(l.expiresAt).toISOString() : null,
    active: l.active,
  }))

  // Upsert so re-running is idempotent
  const { error } = await supabase
    .from('share_links')
    .upsert(rows, { onConflict: 'token', ignoreDuplicates: true })

  if (!error) {
    localStorage.setItem(flag, 'done')
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a share link. Tries Supabase first; falls back to localStorage.
 * Returns the created ShareLink (with a synthetic `id` in fallback mode).
 */
export async function createLink(input: CreateLinkInput): Promise<ShareLink> {
  const supabase = getBrowserSupabase()

  if (supabase) {
    const payload: Record<string, unknown> = {
      workbook_id: input.workbookId,
      role: input.role,
    }
    if (input.expiresAt) {
      payload['expires_at'] = new Date(input.expiresAt).toISOString()
    }

    // randomToken must come from the server action because crypto.randomBytes
    // is unavailable in client bundles. We still hit the server action for token
    // generation via actions.ts (createShareLinkAction), but store the result
    // locally here so the dialog can read back the created row without refetching.
    // However, the createShareLinkAction path is used from ShareDialog directly.
    // This path is for when the caller wants a pure-client flow.
    const { data, error } = await supabase
      .from('share_links')
      .insert(payload)
      .select('id, token, workbook_id, role, expires_at, active, created_at')
      .single()

    if (!error && data) {
      // Trigger migration on first successful write
      void migrateLocalLinksOnce(input.workbookId)
      return rowToShareLink(data as Record<string, unknown>)
    }
    // fall through to localStorage on error (e.g. 403 – user is not the owner)
  }

  // localStorage fallback — also called when Supabase isn't configured
  const local = createLocalShareLink({
    workbookId: input.workbookId,
    role: input.role,
    expiresAt: input.expiresAt ?? null,
  })
  return localToShareLink(local)
}

/**
 * List all share links for a workbook.
 * Supabase-first; falls back to localStorage.
 */
export async function listLinks(workbookId: string): Promise<ShareLink[]> {
  const supabase = getBrowserSupabase()

  if (supabase) {
    const { data, error } = await supabase
      .from('share_links')
      .select('id, token, workbook_id, role, expires_at, active, created_at')
      .eq('workbook_id', workbookId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      return (data as Record<string, unknown>[]).map(rowToShareLink)
    }
  }

  // localStorage fallback
  return listLocalShareLinks(workbookId).map(localToShareLink)
}

/**
 * Revoke a share link. Supabase-first; always also revokes the localStorage copy.
 */
export async function revokeLink(workbookId: string, token: string): Promise<void> {
  const supabase = getBrowserSupabase()

  if (supabase) {
    await supabase
      .from('share_links')
      .update({ active: false })
      .eq('workbook_id', workbookId)
      .eq('token', token)
    // Don't early-return on error — always revoke the local copy too
  }

  revokeLocalShareLink(workbookId, token)
}

/**
 * Resolve a share token CLIENT-SIDE.
 *
 * NOTE: The server page at /s/[token] uses resolveShareTokenAction (which uses
 * the service-role Supabase client) for authoritative server-side resolution.
 * This function is used for the localStorage fallback path (LocalShareTokenResolver)
 * and for test/standalone scenarios.
 *
 * It does NOT use the Supabase anon client for resolution because the anon client
 * can only read rows where `active = true AND (expires_at IS NULL OR expires_at > now())`
 * per RLS — that's correct for the *public* resolve path, but the server action
 * must be the authority to avoid TOCTOU races.  Client code that needs the resolved
 * workbookId must go through the /s/[token] page redirect.
 */
export function resolveToken(token: string): ResolveResult {
  return resolveLocalShareToken(token)
}
