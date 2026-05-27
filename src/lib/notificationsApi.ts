'use client'

/**
 * notificationsApi — in-app notification data path.
 *
 * Behaviour mirrors commentsApi:
 *   1. Supabase + valid session  → talk to the `notifications` table.
 *   2. Otherwise (no Supabase / no session / network error) → graceful
 *      no-op: reads return empty arrays, writes are silently dropped.
 *
 * The notifications feature is intentionally thin: there is no
 * localStorage fallback (notifications are only meaningful when the
 * recipient is signed in, and the bell disappears in offline/demo mode).
 */

import { getBrowserSupabase } from './supabase/client'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface NotificationRecord {
  id: string
  userId: string
  workbookId: string
  sheetId: string
  commentId: string | null
  actorId: string | null
  actorName: string | null
  type: string
  body: string
  read: boolean
  createdAt: number
}

/** Row shape returned from Supabase `notifications` table. */
interface DbNotificationRow {
  id: string
  user_id: string
  workbook_id: string
  sheet_id: string
  comment_id: string | null
  actor_id: string | null
  type: string
  body: string
  read: boolean
  created_at: string
  // Supabase returns a foreign-key join as a single object (or null) when
  // the relationship is !inner / 1-1. The Supabase client types it as an
  // array in some SDK versions, so we accept both shapes.
  profiles?: { display_name: string | null } | { display_name: string | null }[] | null
}

function getProfileDisplayName(
  profiles: { display_name: string | null } | { display_name: string | null }[] | null | undefined
): string | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0]?.display_name ?? null
  return profiles.display_name
}

function dbRowToRecord(row: DbNotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    commentId: row.comment_id,
    actorId: row.actor_id,
    actorName: getProfileDisplayName(row.profiles),
    type: row.type,
    body: row.body,
    read: Boolean(row.read),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase()
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all notifications for the currently signed-in user, newest first.
 * Returns an empty array when not signed in or on any network error.
 */
export async function loadNotifications(): Promise<NotificationRecord[]> {
  const supabase = getBrowserSupabase()
  const userId = supabase ? await getCurrentUserId() : null
  if (!supabase || !userId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, user_id, workbook_id, sheet_id, comment_id, actor_id, type, body, read, created_at, profiles!notifications_actor_id_fkey(display_name)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) return []
  return (data as DbNotificationRow[]).map(dbRowToRecord)
}

/**
 * Count of unread notifications for the current user.
 * Fast single-column query — no payload overhead.
 * Returns 0 when not signed in or on any error.
 */
export async function unreadCount(): Promise<number> {
  const supabase = getBrowserSupabase()
  const userId = supabase ? await getCurrentUserId() : null
  if (!supabase || !userId) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) return 0
  return count ?? 0
}

/**
 * Mark a single notification as read. No-op when not signed in.
 */
export async function markRead(notificationId: string): Promise<void> {
  const supabase = getBrowserSupabase()
  const userId = supabase ? await getCurrentUserId() : null
  if (!supabase || !userId) return

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
}

/**
 * Mark every unread notification for the current user as read.
 * No-op when not signed in.
 */
export async function markAllRead(): Promise<void> {
  const supabase = getBrowserSupabase()
  const userId = supabase ? await getCurrentUserId() : null
  if (!supabase || !userId) return

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
}

// ---------------------------------------------------------------------------
// Mention → user resolution + notification insert
// ---------------------------------------------------------------------------

/**
 * Resolve @display-name strings to user_ids by joining
 * `workbook_members` → `profiles`.
 *
 * Returns a map of lowercased display-name → user_id for every mention
 * that can be resolved to a workbook member. Unresolvable handles are
 * silently omitted.
 *
 * @param workbookId  UUID of the workbook where the comment lives.
 * @param mentions    Raw mention handles from parseMentions() (already
 *                    lowercased, no leading @).
 */
export async function resolveMentionsToUserIds(
  workbookId: string,
  mentions: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (mentions.length === 0) return result

  const supabase = getBrowserSupabase()
  if (!supabase) return result

  // Query: members of this workbook whose profile display_name (lowercased)
  // matches one of the mention handles. We fetch up to 100 rows — a
  // workbook will never realistically have more collaborators than that.
  const { data, error } = await supabase
    .from('workbook_members')
    .select('user_id, profiles!workbook_members_user_id_fkey(display_name)')
    .eq('workbook_id', workbookId)
    .limit(100)

  if (error || !data) return result

  type MemberRow = {
    user_id: string
    profiles:
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null
  }

  for (const row of data as MemberRow[]) {
    const rawProfiles = row.profiles
    const dn = Array.isArray(rawProfiles)
      ? (rawProfiles[0]?.display_name ?? null)
      : (rawProfiles?.display_name ?? null)
    if (!dn) continue
    const normalized = dn.toLowerCase().replace(/\s+/g, '')
    if (mentions.includes(normalized)) {
      result.set(normalized, row.user_id)
    }
  }

  return result
}

/**
 * Insert one `notifications` row per resolved mentioned user.
 *
 * Called immediately after a comment is stored in Supabase.
 * Errors are swallowed so a notification failure never breaks the
 * comment-creation flow.
 *
 * @param opts.workbookId  UUID of the workbook.
 * @param opts.sheetId     Sheet string id.
 * @param opts.commentId   UUID of the newly-created comment.
 * @param opts.actorId     UUID of the user who wrote the comment.
 * @param opts.actorName   Display name of the author (for the body text).
 * @param opts.mentions    Lowercased mention handles from parseMentions().
 * @param opts.body        Comment body (used to build the notification text).
 */
export async function insertMentionNotifications(opts: {
  workbookId: string
  sheetId: string
  commentId: string
  actorId: string
  actorName: string | null
  mentions: string[]
  body: string
}): Promise<void> {
  const { workbookId, sheetId, commentId, actorId, actorName, mentions, body } = opts

  if (mentions.length === 0) return

  const supabase = getBrowserSupabase()
  if (!supabase) return

  try {
    const mentionToUserId = await resolveMentionsToUserIds(workbookId, mentions)
    if (mentionToUserId.size === 0) return

    // Truncate the comment body for the notification text.
    const preview = body.length > 120 ? body.slice(0, 117) + '…' : body
    const authorLabel = actorName ?? 'Someone'

    const rows = Array.from(mentionToUserId.values()).map((recipientId) => ({
      user_id: recipientId,
      workbook_id: workbookId,
      sheet_id: sheetId,
      comment_id: commentId,
      actor_id: actorId,
      type: 'mention' as const,
      body: `${authorLabel} mentioned you: "${preview}"`,
      read: false,
    }))

    const { error } = await supabase.from('notifications').insert(rows)
    if (error) {
      // Intentionally debug-level — notification failure is non-fatal.
      // eslint-disable-next-line no-console
      console.debug('[notificationsApi] mention insert failed:', error.message)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('[notificationsApi] insertMentionNotifications error:', err)
  }
}
