'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { debouncedSave, saveWorkbook, flushPendingSave } from '@/lib/saveService'
import { cn } from '@/lib/utils'

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict' | 'offline'

interface SaveStatusProps {
  workbookName: string
  workbookData: unknown
  workbookId?: string
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function SaveStatus({ workbookName, workbookData, workbookId }: SaveStatusProps) {
  const { isSaving, lastSavedAt, setIsSaving, setLastSavedAt, isHydrated } = useSheetStore()
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [currentId, setCurrentId] = useState<string | undefined>(workbookId)

  const savePayloadRef = useRef({ workbookName, workbookData, currentId })
  useEffect(() => {
    savePayloadRef.current = { workbookName, workbookData, currentId }
  }, [currentId, workbookData, workbookName])

  const performSave = useCallback(async () => {
    setSaveState('saving')
    setIsSaving(true)

    const { workbookName: name, workbookData: data, currentId: id } = savePayloadRef.current
    const result = await saveWorkbook({ ...(id ? { id } : {}), name, data })

    setIsSaving(false)

    if (result.conflict) {
      // Someone else saved this workbook first. The local copy is safe;
      // surface a conflict state — clicking it reloads to get their changes.
      setSaveState('conflict')
      return
    }

    if (result.id && result.destination === 'supabase') {
      // Server confirmed the save. Pin the id so subsequent saves UPDATE.
      setCurrentId(result.id)
      setLastSavedAt(new Date())
      setSaveState('saved')
      return
    }

    // Save fell back to localStorage. Show an HONEST distinct state — the
    // old behavior showed plain "Saved", which made cloud-save failures
    // invisible (users believed their data synced when it only lived in
    // this browser). Not 'error': the work IS safe locally; clicking
    // retries the cloud save.
    setLastSavedAt(new Date())
    setSaveState('offline')
  }, [setIsSaving, setLastSavedAt])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

      if (ctrlOrCmd && e.key === 's') {
        e.preventDefault()
        void performSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [performSave])

  // Flush any pending debounced save when the user navigates away or closes
  // the tab — otherwise edits made inside the debounce window are lost.
  useEffect(() => {
    const flush = () => flushPendingSave()
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      // Component unmount (e.g. client-side route change) — flush too.
      flushPendingSave()
    }
  }, [])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // HYDRATION GATE — never autosave before the mount-time load finishes.
    // The name-load effect changes workbookName right after mount, which
    // armed a 2s-debounced save of the PRISTINE EMPTY grid; when the
    // server GET took >2s, that empty save overwrote the user's data
    // (no baseUpdatedAt on a fresh reload → unconditional update).
    // When isHydrated flips true this effect re-runs and arms one save
    // with the REAL hydrated data — which also syncs any pending local
    // copy to the cloud.
    if (!isHydrated) return

    setSaveState('unsaved')
    // Autosave through the shared debounce, and update the indicator when it
    // resolves. Previously this was fire-and-forget, so the chip stayed on
    // "Unsaved changes" forever even though the save succeeded (POST 200) —
    // which made it look like nothing was saving.
    debouncedSave(
      {
        ...(currentId ? { id: currentId } : {}),
        name: workbookName,
        data: workbookData,
      },
      (result) => {
        if (result.conflict) {
          setSaveState('conflict')
          return
        }
        if (result.id && result.destination === 'supabase') setCurrentId(result.id)
        setLastSavedAt(new Date())
        setSaveState(result.destination === 'supabase' ? 'saved' : 'offline')
      },
    )
  }, [currentId, workbookData, workbookName, setLastSavedAt, isHydrated])

  const statusConfig = {
    saved: {
      label: lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : 'Saved',
      color: 'text-green-600',
      icon: 'OK',
      spin: false,
    },
    saving: {
      label: 'Saving...',
      color: 'text-zinc-400',
      icon: '...',
      spin: false,
    },
    unsaved: {
      label: 'Unsaved changes',
      color: 'text-zinc-400',
      icon: '*',
      spin: false,
    },
    error: {
      label: 'Save failed - click to retry',
      color: 'text-red-500',
      icon: '!',
      spin: false,
    },
    conflict: {
      label: 'Edited elsewhere - click to reload',
      color: 'text-amber-600',
      icon: '!',
      spin: false,
    },
    offline: {
      label: 'Saved on this device - not synced',
      color: 'text-amber-600',
      icon: '⌂',
      spin: false,
    },
  } as const

  const current = statusConfig[saveState]

  // In a conflict, clicking reloads to pull the other person's changes (the
  // local copy is already safe in localStorage); otherwise it saves.
  const handleClick = () => {
    if (saveState === 'conflict') {
      if (typeof window !== 'undefined') window.location.reload()
      return
    }
    void performSave()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={saveState === 'conflict' ? 'Reload to get the latest version' : 'Save (Ctrl+S)'}
      disabled={isSaving}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
        'text-xs transition-colors hover:bg-zinc-100 disabled:cursor-default dark:hover:bg-zinc-800',
        current.color
      )}
    >
      <span className={cn(current.spin && 'inline-block animate-spin')}>{current.icon}</span>
      {current.label}
    </button>
  )
}
