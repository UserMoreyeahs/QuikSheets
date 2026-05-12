'use client'

/**
 * useInlineEditSync
 *
 * Bridges FortuneSheet's internal inline cell editor with our custom formula
 * bar.  FortuneSheet doesn't expose hooks for edit-mode start/stop or
 * keystroke-level changes, so we observe the DOM directly:
 *
 *   .luckysheet-input-box   — visible when editing  (zIndex 19)
 *   .luckysheet-cell-input  — contentEditable <div>  (id: luckysheet-rich-text-editor)
 *
 * When the user types in the grid cell, this hook mirrors the text to the
 * formula bar store so the bar stays in sync — exactly like Excel.
 */

import { useEffect, useRef } from 'react'
import { useSheetStore } from '@/store/sheetStore'

/**
 * Extracts plain text from the FortuneSheet rich-text editor element.
 * The editor uses <span class="luckysheet-input-span"> nodes for styled
 * fragments, but we only need the raw text for the formula bar.
 */
function getEditorText(el: HTMLElement): string {
  return el.textContent ?? ''
}

export function useInlineEditSync(containerRef: React.RefObject<HTMLDivElement | null>) {
  const isActiveRef = useRef(false)
  const inputListenerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const containerEl = containerRef.current
    if (!containerEl) return

    // Local alias — TypeScript narrows containerEl to non-null after the guard
    // above, but closures below lose that narrowing.
    const container: HTMLElement = containerEl

    let editorEl: HTMLElement | null = null
    let observerCleanup: (() => void) | null = null
    let rafId: number | null = null

    /** Sync editor text → formula bar store (throttled to one rAF) */
    function syncToFormulaBar() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!editorEl || !isActiveRef.current) return
        const text = getEditorText(editorEl)
        const state = useSheetStore.getState()
        // Only sync when the formula bar is NOT focused (the user is editing
        // in the grid, not in the bar).  When the bar has focus the user is
        // editing *there*, so we don't overwrite.
        if (state.editingCell && !document.querySelector('.formula-bar-input:focus')) {
          state.setFormulaBarValue(text)
        }
      })
    }

    function onEditorInput() {
      syncToFormulaBar()
    }

    /** Start listening to the inline editor */
    function attachEditor(el: HTMLElement) {
      editorEl = el
      isActiveRef.current = true
      el.addEventListener('input', onEditorInput)

      // Also sync the initial value when editing starts
      syncToFormulaBar()

      inputListenerRef.current = () => {
        el.removeEventListener('input', onEditorInput)
        editorEl = null
        isActiveRef.current = false
      }
    }

    function detachEditor() {
      inputListenerRef.current?.()
      inputListenerRef.current = null
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    /**
     * Observe the .luckysheet-input-box for style changes.
     * When zIndex flips from -1 → 19 the user has entered edit mode.
     */
    function startObserving() {
      const inputBox = container.querySelector<HTMLElement>('.luckysheet-input-box')
      if (!inputBox) return

      const observer = new MutationObserver(() => {
        const z = inputBox.style.zIndex
        const isEditing = z !== '' && z !== '-1'

        if (isEditing && !isActiveRef.current) {
          const cellInput = inputBox.querySelector<HTMLElement>('.luckysheet-cell-input')
          if (cellInput) {
            attachEditor(cellInput)
          }
        } else if (!isEditing && isActiveRef.current) {
          detachEditor()
        }
      })

      observer.observe(inputBox, {
        attributes: true,
        attributeFilter: ['style'],
      })

      observerCleanup = () => observer.disconnect()
    }

    // FortuneSheet renders asynchronously — the input-box may not exist yet.
    // Retry with a short delay until it appears, then start the observer.
    let retryTimer: number | null = null
    let retries = 0
    const MAX_RETRIES = 20 // ~2 seconds

    function tryStart() {
      const inputBox = container.querySelector<HTMLElement>('.luckysheet-input-box')
      if (inputBox) {
        startObserving()
        return
      }
      retries += 1
      if (retries < MAX_RETRIES) {
        retryTimer = window.setTimeout(tryStart, 100)
      }
    }

    tryStart()

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      detachEditor()
      observerCleanup?.()
    }
  }, [containerRef])
}
