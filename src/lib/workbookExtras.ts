/**
 * Workbook "extras" persistence — the visualization objects that live in
 * their own Zustand stores and were previously LOST on reload: charts,
 * pivots, sparklines, slicers, images, and overlays (shapes/icons/text).
 *
 * These never rode along with the cell data (gridSheets) that saveService
 * persists, so reopening a workbook dropped every chart/image the user
 * inserted. This module collects all six stores into one serializable blob
 * and restores them, keyed by workbook id in localStorage.
 *
 * Zustand exposes getState()/setState() on the store hook itself, so we can
 * read and hydrate each store WITHOUT modifying any of them.
 *
 * NOTE: images/overlays may carry base64 data URLs; a very large gallery can
 * exceed the localStorage quota — saveWorkbookExtras degrades silently in
 * that case (best-effort), matching saveService's fallback behaviour.
 */

import { useChartPanelStore } from '@/features/charts/store/chartPanelStore'
import { usePivotUiStore } from '@/features/pivot/store/pivotUiStore'
import { useSparklineStore } from '@/features/sparklines/store/sparklineStore'
import { useSlicerStore } from '@/features/slicers/store/slicerStore'
import { useImageStore } from '@/features/images/store/imageStore'
import { useOverlayStore } from '@/features/overlays/store/overlayStore'
import { getBrowserSupabase } from './supabase/client'
import { getClientSession } from './supabase/getClientSession'
import { logger } from './logger'

export interface WorkbookExtras {
  charts: unknown[]
  pivots: unknown[]
  sparklines: unknown[]
  slicers: unknown[]
  images: unknown[]
  overlays: unknown[]
}

const EMPTY: WorkbookExtras = {
  charts: [], pivots: [], sparklines: [], slicers: [], images: [], overlays: [],
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

/** Read the current visualization objects from all six stores. */
export function collectWorkbookExtras(): WorkbookExtras {
  return {
    charts: useChartPanelStore.getState().charts,
    pivots: usePivotUiStore.getState().pivots,
    sparklines: useSparklineStore.getState().sparklines,
    slicers: useSlicerStore.getState().slicers,
    images: useImageStore.getState().images,
    overlays: useOverlayStore.getState().overlays,
  }
}

/**
 * Replace the visualization objects in all six stores. Always sets ALL six
 * arrays (defaulting to []) so opening workbook B clears workbook A's
 * leftovers from these global singleton stores.
 */
export function applyWorkbookExtras(extras: Partial<WorkbookExtras> | null): void {
  const e = { ...EMPTY, ...(extras ?? {}) }
  // `as never`: the loaded arrays are JSON round-trips of the stores' own
  // item types; never is assignable to each concrete element type.
  useChartPanelStore.setState({ charts: asArray(e.charts) as never })
  usePivotUiStore.setState({ pivots: asArray(e.pivots) as never })
  useSparklineStore.setState({ sparklines: asArray(e.sparklines) as never })
  useSlicerStore.setState({ slicers: asArray(e.slicers) as never })
  useImageStore.setState({ images: asArray(e.images) as never })
  useOverlayStore.setState({ overlays: asArray(e.overlays) as never })
}

export function hasAnyExtras(e: WorkbookExtras): boolean {
  return (
    e.charts.length + e.pivots.length + e.sparklines.length +
    e.slicers.length + e.images.length + e.overlays.length
  ) > 0
}

const KEY = (workbookId: string) => `quiksheets_workbook_extras:${workbookId}`

export function loadWorkbookExtras(workbookId: string): WorkbookExtras | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(KEY(workbookId))
    if (!raw) return null
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<WorkbookExtras>) }
  } catch {
    return null
  }
}

export function saveWorkbookExtras(workbookId: string, extras: WorkbookExtras): void {
  try {
    if (typeof window === 'undefined') return
    // Don't write an all-empty blob over a (possibly) populated one on the
    // very first mount before anything is added — but DO write empties once
    // the user has cleared things. We only skip when nothing exists AND no
    // key is present yet, to avoid creating noise keys.
    if (!hasAnyExtras(extras) && !window.localStorage.getItem(KEY(workbookId))) return
    window.localStorage.setItem(KEY(workbookId), JSON.stringify(extras))
  } catch {
    // Quota (large base64 images) or serialization failure — best-effort.
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Supabase-first persistence (cloud sync) with localStorage fallback + cache.
// Mirrors the cfRulesApi pattern: cloud (UUID) workbooks round-trip the
// `workbook_extras` table; local/offline workbooks use localStorage only.
// ───────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Load a workbook's extras, Supabase-first for cloud workbooks (and cache the
 * result to localStorage), else from localStorage. Never throws.
 */
export async function loadWorkbookExtrasResolved(workbookId: string): Promise<WorkbookExtras | null> {
  if (UUID_RE.test(workbookId)) {
    try {
      const supabase = getBrowserSupabase()
      const session = supabase ? await getClientSession() : null
      if (supabase && session) {
        const { data, error } = await supabase
          .from('workbook_extras')
          .select('extras_json')
          .eq('workbook_id', workbookId)
          .maybeSingle()
        if (!error && data) {
          const remote: WorkbookExtras = {
            ...EMPTY,
            ...(((data as { extras_json?: Partial<WorkbookExtras> }).extras_json) ?? {}),
          }
          saveWorkbookExtras(workbookId, remote) // refresh local cache
          return remote
        }
      }
    } catch (err) {
      logger.debug('workbookExtras', 'remote load failed; using local', err)
    }
  }
  return loadWorkbookExtras(workbookId)
}

/**
 * Persist a workbook's extras: always to localStorage (cache/offline) and, for
 * cloud workbooks, upsert to Supabase. Never throws.
 */
export async function saveWorkbookExtrasResolved(
  workbookId: string,
  extras: WorkbookExtras,
): Promise<void> {
  saveWorkbookExtras(workbookId, extras)
  if (!UUID_RE.test(workbookId)) return
  try {
    const supabase = getBrowserSupabase()
    const session = supabase ? await getClientSession() : null
    if (supabase && session) {
      const { error } = await supabase
        .from('workbook_extras')
        .upsert({ workbook_id: workbookId, extras_json: extras }, { onConflict: 'workbook_id' })
      if (error) logger.debug('workbookExtras', 'remote save failed; kept local', error.message)
    }
  } catch (err) {
    logger.debug('workbookExtras', 'remote save threw; kept local', err)
  }
}
