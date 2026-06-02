'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/features/dashboards'
import { useConnectorsStore } from '@/features/connectors'
import { useRowRlsStore } from '@/features/row-rls'

/**
 * On workbook mount, load each P2 feature's data (dashboards / connectors /
 * row-level security rules) from Supabase via the per-feature *Api modules.
 * Each store's load() is idempotent and Supabase-first w/ localStorage fallback.
 *
 * The 'demo' workbook short-circuits in each store so we don't hit Supabase
 * for the synthetic demo data.
 */
export function useLoadP2FeaturesOnMount(workbookId: string): void {
  useEffect(() => {
    if (!workbookId || workbookId === 'demo') return
    void useDashboardStore.getState().load(workbookId)
    void useConnectorsStore.getState().loadConnections?.(workbookId)
    void useRowRlsStore.getState().loadRules(workbookId)
  }, [workbookId])
}
