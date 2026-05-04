'use client'

/**
 * localStorage-backed version history.  Captures full snapshots of the
 * workbook's gridSheets[] so we can restore them exactly later.
 *
 * Storage layout:
 *   sheetforge_version_index:<workbookId> →  string[] of versionIds
 *   sheetforge_version:<versionId>        →  StoredVersion
 *
 * We cap at MAX_VERSIONS per workbook (oldest pruned first) to avoid
 * unbounded localStorage growth.
 */

import type { Sheet } from '@fortune-sheet/core'

const MAX_VERSIONS = 30

export interface StoredVersion {
  id: string
  workbookId: string
  label: string
  createdAt: number
  /** Serialized gridSheets — opaque, restored verbatim. */
  snapshot: Sheet[]
}

const INDEX_KEY = (workbookId: string) => `sheetforge_version_index:${workbookId}`
const VERSION_KEY = (id: string) => `sheetforge_version:${id}`

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

function readIndex(workbookId: string): string[] {
  if (typeof window === 'undefined') return []
  return safeParse<string[]>(localStorage.getItem(INDEX_KEY(workbookId))) ?? []
}

function writeIndex(workbookId: string, ids: string[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INDEX_KEY(workbookId), JSON.stringify(ids))
}

export function snapshotWorkbook(
  workbookId: string,
  gridSheets: Sheet[],
  label?: string
): StoredVersion {
  if (typeof window === 'undefined') {
    throw new Error('snapshotWorkbook must be called in browser')
  }
  const id = crypto.randomUUID()
  const stored: StoredVersion = {
    id,
    workbookId,
    label: (label ?? '').trim() || `Snapshot ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    // deep-clone via JSON round-trip so future grid mutations don't poison this snapshot
    snapshot: JSON.parse(JSON.stringify(gridSheets)) as Sheet[],
  }
  localStorage.setItem(VERSION_KEY(id), JSON.stringify(stored))

  // prepend to index, prune to MAX_VERSIONS
  const index = [id, ...readIndex(workbookId)]
  const overflow = index.slice(MAX_VERSIONS)
  for (const removeId of overflow) {
    localStorage.removeItem(VERSION_KEY(removeId))
  }
  writeIndex(workbookId, index.slice(0, MAX_VERSIONS))
  return stored
}

export function listWorkbookVersions(workbookId: string): StoredVersion[] {
  return readIndex(workbookId)
    .map((id) => safeParse<StoredVersion>(localStorage.getItem(VERSION_KEY(id))))
    .filter((v): v is StoredVersion => v !== null)
}

export function getVersion(id: string): StoredVersion | null {
  if (typeof window === 'undefined') return null
  return safeParse<StoredVersion>(localStorage.getItem(VERSION_KEY(id)))
}

export function deleteVersion(workbookId: string, id: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(VERSION_KEY(id))
  writeIndex(workbookId, readIndex(workbookId).filter((x) => x !== id))
}
