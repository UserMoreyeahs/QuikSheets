'use client'

/**
 * localStorage-backed share-link store.  Used as a fallback when Supabase
 * is not configured (so the standalone mode still produces usable links).
 *
 * The /s/[token] route prefers Supabase via resolveShareTokenAction; if that
 * returns "not_found" it can fall back to this store.
 */

export interface LocalShareLink {
  token: string
  workbookId: string
  role: 'viewer' | 'editor'
  createdAt: number
  expiresAt: number | null
  active: boolean
}

const KEY = (workbookId: string) => `sheetforge_share_links:${workbookId}`
const TOKEN_KEY = (token: string) => `sheetforge_share_token:${token}`

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

function readWorkbookLinks(workbookId: string): LocalShareLink[] {
  if (typeof window === 'undefined') return []
  return safeParse<LocalShareLink[]>(localStorage.getItem(KEY(workbookId))) ?? []
}

function writeWorkbookLinks(workbookId: string, list: LocalShareLink[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY(workbookId), JSON.stringify(list))
}

function makeToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function createLocalShareLink(input: {
  workbookId: string
  role: 'viewer' | 'editor'
  expiresAt?: number | null
}): LocalShareLink {
  const link: LocalShareLink = {
    token: makeToken(),
    workbookId: input.workbookId,
    role: input.role,
    createdAt: Date.now(),
    expiresAt: input.expiresAt ?? null,
    active: true,
  }
  const list = readWorkbookLinks(input.workbookId)
  list.unshift(link)
  writeWorkbookLinks(input.workbookId, list)
  // also index by token for easy resolve
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY(link.token), JSON.stringify(link))
  }
  return link
}

export function listLocalShareLinks(workbookId: string): LocalShareLink[] {
  return readWorkbookLinks(workbookId).sort((a, b) => b.createdAt - a.createdAt)
}

export function revokeLocalShareLink(workbookId: string, token: string): void {
  const next = readWorkbookLinks(workbookId).map((l) =>
    l.token === token ? { ...l, active: false } : l
  )
  writeWorkbookLinks(workbookId, next)
  // update token index too
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(TOKEN_KEY(token))
    const parsed = safeParse<LocalShareLink>(raw)
    if (parsed) {
      localStorage.setItem(TOKEN_KEY(token), JSON.stringify({ ...parsed, active: false }))
    }
  }
}

export function resolveLocalShareToken(token: string): {
  ok: boolean
  workbookId?: string
  role?: 'viewer' | 'editor'
  reason?: 'not_found' | 'expired' | 'inactive'
} {
  if (typeof window === 'undefined') return { ok: false, reason: 'not_found' }
  const link = safeParse<LocalShareLink>(localStorage.getItem(TOKEN_KEY(token)))
  if (!link) return { ok: false, reason: 'not_found' }
  if (!link.active) return { ok: false, reason: 'inactive' }
  if (link.expiresAt && link.expiresAt < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, workbookId: link.workbookId, role: link.role }
}
