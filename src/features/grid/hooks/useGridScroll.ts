'use client'

/**
 * useGridScroll  (singleton)
 * --------------------------
 * Tracks FortuneSheet's internal scroll position so floating objects
 * (charts, pivots, slicers, cursors) can scroll-anchor to cell positions.
 *
 * **Performance**: a single scroll listener is shared across ALL consumers.
 * Scroll events are throttled with `requestAnimationFrame` and the snapshot
 * object is only replaced when values actually change — so React skips
 * re-renders when the scroll position hasn't moved.
 *
 * Uses `useSyncExternalStore` for tear-free concurrent-mode reads.
 */

import { useEffect, useSyncExternalStore } from 'react'

export interface GridScrollOffset {
  scrollLeft: number
  scrollTop: number
}

// ── Module-level singleton state ──────────────────────────────────────
let _scrollLeft = 0
let _scrollTop = 0
/** Cached snapshot — only replaced when values actually change. */
let _snapshot: GridScrollOffset = { scrollLeft: 0, scrollTop: 0 }

const _subscribers = new Set<() => void>()
let _bound = false
let _rafId = 0

function notify() {
  for (const cb of _subscribers) cb()
}

/**
 * Find FortuneSheet's internal scroll container in the DOM.
 */
function findScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('.luckysheet-grid-window') ??
    document.querySelector<HTMLElement>('.fortune-sheet-grid-window') ??
    document.querySelector<HTMLElement>('.fortune-sheet-container .luckysheet-cell-main') ??
    null
  )
}

function handleScroll(el: HTMLElement) {
  cancelAnimationFrame(_rafId)
  _rafId = requestAnimationFrame(() => {
    if (el.scrollLeft !== _scrollLeft || el.scrollTop !== _scrollTop) {
      _scrollLeft = el.scrollLeft
      _scrollTop = el.scrollTop
      _snapshot = { scrollLeft: _scrollLeft, scrollTop: _scrollTop }
      notify()
    }
  })
}

function bindScrollListener(): boolean {
  if (_bound) return true
  const el = findScrollContainer()
  if (!el) return false
  _bound = true
  el.addEventListener('scroll', () => handleScroll(el), { passive: true })
  // Read initial position
  _scrollLeft = el.scrollLeft
  _scrollTop = el.scrollTop
  _snapshot = { scrollLeft: _scrollLeft, scrollTop: _scrollTop }
  return true
}

// ── useSyncExternalStore glue ─────────────────────────────────────────
function subscribe(callback: () => void) {
  _subscribers.add(callback)
  return () => { _subscribers.delete(callback) }
}

function getSnapshot(): GridScrollOffset {
  return _snapshot
}

/**
 * Hook — returns the current `{ scrollLeft, scrollTop }`.
 *
 * All callers share a single scroll listener.  The returned object
 * reference is stable (same `===`) when the values haven't changed,
 * so React avoids unnecessary re-renders.
 */
export function useGridScroll(): GridScrollOffset {
  // Lazily bind the scroll listener (FortuneSheet may mount late)
  useEffect(() => {
    if (bindScrollListener()) return
    // Retry once after FortuneSheet is likely mounted
    const timer = setTimeout(() => {
      bindScrollListener()
      // If we just bound, notify subscribers with the initial position
      notify()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Given a cell anchor (row, col) and scroll offset, compute the absolute
 * pixel position within the grid container.
 *
 * Uses FortuneSheet's default row height (20px) and column width (73px)
 * with header offsets.
 */
export function cellToPixelPosition(
  anchorRow: number,
  anchorCol: number,
  scrollOffset: GridScrollOffset,
): { x: number; y: number } {
  const ROW_HEIGHT = 20
  const COL_WIDTH = 73
  const HEADER_WIDTH = 46 // row header
  const HEADER_HEIGHT = 20 // column header

  return {
    x: HEADER_WIDTH + anchorCol * COL_WIDTH - scrollOffset.scrollLeft,
    y: HEADER_HEIGHT + anchorRow * ROW_HEIGHT - scrollOffset.scrollTop,
  }
}
