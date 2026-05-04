'use client'

/**
 * localStorage-backed comments store — runs without Supabase auth.  Comments
 * are keyed per workbook + sheet + cell address, with thread support and a
 * resolved flag to mirror the server schema.
 */

export interface LocalComment {
  id: string
  workbookId: string
  sheetId: string
  cellAddress: string  // e.g. "B3"
  body: string
  author: string       // "You" by default in standalone mode
  mentions: string[]   // raw @handles parsed from body
  resolved: boolean
  createdAt: number
}

const KEY = (workbookId: string) => `sheetforge_comments:${workbookId}`

function parse(raw: string | null): LocalComment[] {
  if (!raw) return []
  try { return JSON.parse(raw) as LocalComment[] } catch { return [] }
}

function readAll(workbookId: string): LocalComment[] {
  if (typeof window === 'undefined') return []
  return parse(localStorage.getItem(KEY(workbookId)))
}

function writeAll(workbookId: string, list: LocalComment[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY(workbookId), JSON.stringify(list))
}

/** All mentions in a body, normalised to @lowercase handles (no spaces). */
export function parseMentions(body: string): string[] {
  const out = new Set<string>()
  const re = /@([A-Za-z0-9_.-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m[1]) out.add(m[1].toLowerCase())
  }
  return Array.from(out)
}

export function listComments(workbookId: string): LocalComment[] {
  return readAll(workbookId).sort((a, b) => a.createdAt - b.createdAt)
}

export function listCommentsForCell(
  workbookId: string,
  sheetId: string,
  cellAddress: string
): LocalComment[] {
  return listComments(workbookId).filter(
    (c) => c.sheetId === sheetId && c.cellAddress === cellAddress
  )
}

export function addComment(
  input: Omit<LocalComment, 'id' | 'createdAt' | 'resolved' | 'mentions'> & {
    resolved?: boolean
  }
): LocalComment {
  const list = readAll(input.workbookId)
  const comment: LocalComment = {
    id: crypto.randomUUID(),
    workbookId: input.workbookId,
    sheetId: input.sheetId,
    cellAddress: input.cellAddress,
    body: input.body,
    author: input.author || 'You',
    mentions: parseMentions(input.body),
    resolved: input.resolved ?? false,
    createdAt: Date.now(),
  }
  list.push(comment)
  writeAll(input.workbookId, list)
  return comment
}

export function setCommentResolved(workbookId: string, id: string, resolved: boolean): void {
  const list = readAll(workbookId)
  const next = list.map((c) => (c.id === id ? { ...c, resolved } : c))
  writeAll(workbookId, next)
}

export function deleteComment(workbookId: string, id: string): void {
  const list = readAll(workbookId)
  writeAll(workbookId, list.filter((c) => c.id !== id))
}

/** Map `cellAddress → unresolved-count` so the grid can render badges. */
export function getCellCommentCounts(workbookId: string, sheetId: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of listComments(workbookId)) {
    if (c.sheetId !== sheetId || c.resolved) continue
    out.set(c.cellAddress, (out.get(c.cellAddress) ?? 0) + 1)
  }
  return out
}
