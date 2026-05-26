'use client'

/**
 * commentsApi — the canonical comments data path.
 *
 * Behaviour:
 *   1. If Supabase is configured AND the user has a session, talk to
 *      Supabase via the browser anon client (RLS does the access check
 *      using auth.uid()).
 *   2. Otherwise — Supabase not configured, user not signed in, or any
 *      network/RLS failure — fall back to the localStorage store so the
 *      UI keeps working in standalone/demo mode.
 *
 * Local + remote shape are kept in sync via the `CommentRecord` type
 * below; the UI does not need to know which one served the request.
 *
 * Migration: on first successful Supabase load with an authenticated
 * user, any local-only comments for the same workbook are flushed up
 * to Supabase (one-time, gated by a localStorage flag).
 */

import { getBrowserSupabase } from './supabase/client'
import {
  addComment as addLocalComment,
  deleteComment as deleteLocalComment,
  listComments as listLocalComments,
  parseMentions,
  setCommentResolved as setLocalCommentResolved,
  type LocalComment,
} from '@/features/comments/storage/localCommentsStore'

/**
 * Unified comment record used by the UI. `LocalComment` is the
 * structural subset — every field present locally is also present here,
 * plus the Supabase-only `updatedAt` and `parentId` slots.
 */
export interface CommentRecord extends LocalComment {
  updatedAt: number
  parentId: string | null
}

/** localStorage flag — set when the one-time per-workbook migration runs. */
const MIGRATED_FLAG_PREFIX = 'quiksheets_comments_migrated_to_supabase'

function migratedFlagKey(workbookId: string): string {
  return `${MIGRATED_FLAG_PREFIX}:${workbookId}`
}

function hasMigratedWorkbook(workbookId: string): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(migratedFlagKey(workbookId)) === 'true'
}

function markWorkbookMigrated(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(migratedFlagKey(workbookId), 'true')
}

function clearLocalWorkbookComments(workbookId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(`quiksheets_comments:${workbookId}`)
}

/** A row shape we read back from the Supabase `comments` table. */
interface DbCommentRow {
  id: string
  workbook_id: string
  sheet_id: string
  cell_address: string
  body: string
  author_id: string
  author_display_name: string | null
  mentions: string[] | null
  parent_id: string | null
  resolved: boolean
  created_at: string
  updated_at: string
}

function dbRowToRecord(row: DbCommentRow): CommentRecord {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    cellAddress: row.cell_address,
    body: row.body,
    author: row.author_display_name ?? 'You',
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
    resolved: Boolean(row.resolved),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    parentId: row.parent_id ?? null,
  }
}

function localToRecord(local: LocalComment): CommentRecord {
  return {
    ...local,
    updatedAt: local.createdAt,
    parentId: null,
  }
}

interface SessionContext {
  userId: string
  displayName: string | null
}

async function getSession(): Promise<SessionContext | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return null
    const displayName =
      (user.user_metadata?.['display_name'] as string | undefined) ??
      (user.user_metadata?.['full_name'] as string | undefined) ??
      user.email ??
      null
    return { userId: user.id, displayName }
  } catch {
    return null
  }
}

/**
 * One-time migration: lift any localStorage comments for this workbook
 * into Supabase, then mark the workbook migrated and clear local data.
 *
 * Safe to call multiple times — the flag short-circuits after the
 * first successful run. If Supabase throws midway, the flag is NOT set
 * and the original localStorage data is preserved, so the user can
 * retry on the next page load.
 */
async function migrateLocalToSupabase(
  workbookId: string,
  session: SessionContext
): Promise<void> {
  if (hasMigratedWorkbook(workbookId)) return
  const local = listLocalComments(workbookId)
  if (local.length === 0) {
    markWorkbookMigrated(workbookId)
    return
  }

  const supabase = getBrowserSupabase()
  if (!supabase) return

  // Insert in chronological order so created_at ordering survives.
  const rows = local
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      workbook_id: workbookId,
      sheet_id: c.sheetId,
      cell_address: c.cellAddress,
      body: c.body,
      author_id: session.userId,
      author_display_name: c.author || session.displayName || null,
      mentions: c.mentions ?? [],
      resolved: Boolean(c.resolved),
      // Pin created_at to preserve original ordering. RLS allows insert
      // because author_id = auth.uid() and the user is at least an
      // editor (only editors can ever write — guarded server-side too).
      created_at: new Date(c.createdAt).toISOString(),
    }))

  const { error } = await supabase.from('comments').insert(rows)
  if (error) {
    // Leave the flag unset so we can retry on next load. Log at debug
    // level to avoid spamming the console on permission failures
    // (e.g. viewer trying to migrate).
    // eslint-disable-next-line no-console
    console.debug('[commentsApi] migration deferred:', error.message)
    return
  }
  markWorkbookMigrated(workbookId)
  clearLocalWorkbookComments(workbookId)
}

// --------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------

/**
 * Read all comments for a workbook, newest-last (matching the legacy
 * listComments() contract).
 *
 * Returns the local fallback if Supabase isn't configured, the user
 * isn't signed in, or the request fails.
 */
export async function loadComments(workbookId: string): Promise<CommentRecord[]> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    return listLocalComments(workbookId).map(localToRecord)
  }

  // Best-effort one-shot migration before the first read returns.
  await migrateLocalToSupabase(workbookId, session)

  const { data, error } = await supabase
    .from('comments')
    .select(
      'id, workbook_id, sheet_id, cell_address, body, author_id, author_display_name, mentions, parent_id, resolved, created_at, updated_at'
    )
    .eq('workbook_id', workbookId)
    .order('created_at', { ascending: true })

  if (error || !data) {
    // RLS deny / network blip — fall back to local cache so the panel
    // still renders something.
    return listLocalComments(workbookId).map(localToRecord)
  }
  return (data as DbCommentRow[]).map(dbRowToRecord)
}

/**
 * Insert a new comment. Mentions are extracted from the body if not
 * passed explicitly.
 *
 * Falls back to localStorage when Supabase isn't reachable.
 */
export async function createComment(input: {
  workbookId: string
  sheetId: string
  cellAddress: string
  body: string
  mentions?: string[]
  parentId?: string | null
}): Promise<CommentRecord> {
  const mentions = input.mentions ?? parseMentions(input.body)
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null

  if (!supabase || !session) {
    const local = addLocalComment({
      workbookId: input.workbookId,
      sheetId: input.sheetId,
      cellAddress: input.cellAddress,
      body: input.body,
      author: 'You',
    })
    return localToRecord(local)
  }

  const insertPayload = {
    workbook_id: input.workbookId,
    sheet_id: input.sheetId,
    cell_address: input.cellAddress,
    body: input.body,
    author_id: session.userId,
    author_display_name: session.displayName,
    mentions,
    parent_id: input.parentId ?? null,
    resolved: false,
  }

  const { data, error } = await supabase
    .from('comments')
    .insert(insertPayload)
    .select(
      'id, workbook_id, sheet_id, cell_address, body, author_id, author_display_name, mentions, parent_id, resolved, created_at, updated_at'
    )
    .single()

  if (error || !data) {
    // Network / RLS deny → mirror to localStorage so the user doesn't
    // lose their comment.
    const local = addLocalComment({
      workbookId: input.workbookId,
      sheetId: input.sheetId,
      cellAddress: input.cellAddress,
      body: input.body,
      author: session.displayName ?? 'You',
    })
    return localToRecord(local)
  }

  return dbRowToRecord(data as DbCommentRow)
}

/** Update a comment's body. Author-only enforced by RLS. */
export async function updateComment(id: string, body: string): Promise<void> {
  const mentions = parseMentions(body)
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null
  if (!supabase || !session) return // no-op for local (UI doesn't expose edit yet)

  await supabase.from('comments').update({ body, mentions }).eq('id', id)
}

/** Delete a comment. Author-only enforced by RLS. */
export async function deleteComment(workbookId: string, id: string): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null
  if (!supabase || !session) {
    deleteLocalComment(workbookId, id)
    return
  }
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) {
    // If RLS rejected (e.g. not the author), surface as a no-op + local
    // delete so the UI still feels responsive. Returning silently is
    // OK — the panel will reconcile on next loadComments() call.
    deleteLocalComment(workbookId, id)
  }
}

/** Resolve/unresolve a comment. Author-only enforced by RLS. */
export async function resolveComment(
  workbookId: string,
  id: string,
  resolved: boolean
): Promise<void> {
  const supabase = getBrowserSupabase()
  const session = supabase ? await getSession() : null
  if (!supabase || !session) {
    setLocalCommentResolved(workbookId, id, resolved)
    return
  }
  const { error } = await supabase.from('comments').update({ resolved }).eq('id', id)
  if (error) {
    setLocalCommentResolved(workbookId, id, resolved)
  }
}

/**
 * Map `cellAddress → unresolved-count` for badge rendering. Reads the
 * already-fetched list so callers don't double-fetch.
 */
export function getCellCommentCounts(
  comments: CommentRecord[],
  sheetId: string
): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of comments) {
    if (c.sheetId !== sheetId || c.resolved) continue
    out.set(c.cellAddress, (out.get(c.cellAddress) ?? 0) + 1)
  }
  return out
}
