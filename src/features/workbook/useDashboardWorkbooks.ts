'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { listWorkbooksAction, type WorkbookSummary } from './actions'

export interface DashboardWorkbook {
  id: string
  name: string
  updatedAt?: string
  source: 'supabase' | 'local'
}

const SUPABASE_KEY = ['dashboard', 'workbooks', 'supabase'] as const

/**
 * List the CURRENT user's local (offline-fallback) workbooks.
 *
 * Reads the user-scoped data blobs `quiksheets_workbook:<scope>:id:<wbId>`
 * written by saveService — scope is the Supabase user id, or 'anon' when
 * logged out. Names come from the blob payload.
 *
 * SECURITY: this must NEVER list another scope's entries. The previous
 * implementation scanned the device-global `quiksheets_workbook_name:<id>`
 * keys (no user segment), so on a shared browser a newly logged-in user saw
 * every workbook ANY previous user had opened — a cross-user leak. Those
 * unscoped name keys are no longer consulted for listing.
 */
export function readLocalWorkbooks(userId: string | null): DashboardWorkbook[] {
  if (typeof window === 'undefined') return []
  try {
    const scope = userId ?? 'anon'
    const prefix = `quiksheets_workbook:${scope}:id:`
    const out: DashboardWorkbook[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const id = key.slice(prefix.length)
      let name = `Workbook ${id.slice(0, 8)}`
      try {
        const blob = JSON.parse(window.localStorage.getItem(key) ?? 'null') as {
          name?: string
        } | null
        if (blob?.name?.trim()) name = blob.name
      } catch {
        /* unreadable blob — keep the derived name */
      }
      out.push({ id, name, source: 'local' })
    }
    return out
  } catch {
    return []
  }
}

function toDashboardRow(row: WorkbookSummary): DashboardWorkbook {
  const result: DashboardWorkbook = {
    id: row.id,
    name: row.name,
    source: 'supabase',
  }
  if (row.updatedAt) result.updatedAt = row.updatedAt
  return result
}

/**
 * Returns workbooks the user can see, sourced from Supabase when the user
 * is authenticated and a Supabase project is configured, otherwise from
 * localStorage. Local workbooks are also surfaced when the user *is*
 * authenticated but has no remote workbooks yet — so a user who created
 * sheets in an earlier (localStorage-only) build still sees them.
 */
export function useDashboardWorkbooks() {
  const [hasAuth, setHasAuth] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [localRows, setLocalRows] = useState<DashboardWorkbook[]>([])
  const qc = useQueryClient()

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) {
      setHasAuth(false)
      setLocalRows(readLocalWorkbooks(null))
      return
    }
    void supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setHasAuth(Boolean(uid))
      setUserId(uid)
      // Only list local blobs AFTER the user scope is known — listing the
      // 'anon' scope to an authenticated user (or vice versa) is the leak.
      setLocalRows(readLocalWorkbooks(uid))
    })
  }, [])

  const remote = useQuery({
    queryKey: SUPABASE_KEY,
    queryFn: () => listWorkbooksAction(),
    enabled: hasAuth === true,
  })

  const remoteRows = (remote.data ?? []).map(toDashboardRow)
  const merged: DashboardWorkbook[] = hasAuth ? [...remoteRows, ...localRows] : localRows
  // De-duplicate by id, preferring supabase rows.
  const seen = new Set<string>()
  const unique: DashboardWorkbook[] = []
  for (const row of merged) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }

  const refreshLocal = useCallback(() => {
    setLocalRows(readLocalWorkbooks(userId))
  }, [userId])

  const refreshRemote = useCallback(() => {
    void qc.invalidateQueries({ queryKey: SUPABASE_KEY })
  }, [qc])

  return {
    workbooks: unique,
    isLoading: hasAuth === null || remote.isLoading,
    hasAuth: hasAuth === true,
    refreshLocal,
    refreshRemote,
  }
}
