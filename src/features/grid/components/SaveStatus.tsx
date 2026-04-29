'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSheetStore } from '@/store/sheetStore'
import { debouncedSave, saveWorkbook } from '@/lib/saveService'
import { cn } from '@/lib/utils'

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'

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
  const { isSaving, lastSavedAt, setIsSaving, setLastSavedAt } = useSheetStore()
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

    if (result) {
      setCurrentId(result.id)
      setLastSavedAt(new Date())
      setSaveState('saved')
      return
    }

    setLastSavedAt(new Date())
    setSaveState('saved')
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

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    setSaveState('unsaved')
    debouncedSave({
      ...(currentId ? { id: currentId } : {}),
      name: workbookName,
      data: workbookData,
    })
  }, [currentId, workbookData, workbookName])

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
  } as const

  const current = statusConfig[saveState]

  return (
    <button
      type="button"
      onClick={() => void performSave()}
      title="Save (Ctrl+S)"
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
