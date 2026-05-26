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

function readLocalWorkbooks(): DashboardWorkbook[] {
  if (typeof window === 'undefined') return []
  try {
    const out: DashboardWorkbook[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith('quiksheets_workbook_name:')) {
        const id = key.replace('quiksheets_workbook_name:', '')
        const name = window.localStorage.getItem(key) ?? `Workbook ${id.slice(0, 8)}`
        out.push({ id, name, source: 'local' })
      }
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
  const [localRows, setLocalRows] = useState<DashboardWorkbook[]>([])
  const qc = useQueryClient()

  useEffect(() => {
    setLocalRows(readLocalWorkbooks())
    const supabase = getBrowserSupabase()
    if (!supabase) {
      setHasAuth(false)
      return
    }
    void supabase.auth.getUser().then(({ data }) => {
      setHasAuth(Boolean(data.user))
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
    setLocalRows(readLocalWorkbooks())
  }, [])

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
