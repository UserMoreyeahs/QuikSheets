/**
 * useWorkbookChannel — unit tests
 *
 * Verifies that multiple hooks subscribing to the same workbookId share a
 * SINGLE Supabase Realtime channel (the core correctness invariant).
 *
 * With useState-based reactivity, `renderHook` wraps the initial render in
 * `act()`, which flushes effects synchronously in jsdom.  After `renderHook`
 * returns the channel is already available in `result.current`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkbookChannel, __resetChannelRegistryForTests } from '@/features/collab/hooks/useWorkbookChannel'

// ── Mock Supabase client ────────────────────────────────────────────────────

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  track: vi.fn().mockResolvedValue(undefined),
  untrack: vi.fn().mockResolvedValue(undefined),
  presenceState: vi.fn().mockReturnValue({}),
}

const mockChannelFactory = vi.fn(() => mockChannel)

const mockSupabase = {
  channel: mockChannelFactory,
}

vi.mock('@/lib/supabase/client', () => ({
  getBrowserSupabase: () => mockSupabase,
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockChannelFactory.mockReturnValue(mockChannel)
  __resetChannelRegistryForTests()
})

afterEach(() => {
  __resetChannelRegistryForTests()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useWorkbookChannel', () => {
  it('creates exactly ONE channel when a single hook mounts', () => {
    const { unmount } = renderHook(() => useWorkbookChannel('wb-1'))
    expect(mockChannelFactory).toHaveBeenCalledTimes(1)
    expect(mockChannelFactory).toHaveBeenCalledWith('workbook:wb-1', expect.any(Object))
    unmount()
  })

  it('creates exactly ONE channel when multiple hooks subscribe to the same workbookId', () => {
    const hook1 = renderHook(() => useWorkbookChannel('wb-shared'))
    const hook2 = renderHook(() => useWorkbookChannel('wb-shared'))
    const hook3 = renderHook(() => useWorkbookChannel('wb-shared'))

    // Only one channel should have been created despite 3 subscribers
    expect(mockChannelFactory).toHaveBeenCalledTimes(1)
    expect(mockChannelFactory).toHaveBeenCalledWith('workbook:wb-shared', expect.any(Object))

    hook1.unmount()
    hook2.unmount()
    hook3.unmount()
  })

  it('creates separate channels for different workbookIds', () => {
    const hook1 = renderHook(() => useWorkbookChannel('wb-a'))
    const hook2 = renderHook(() => useWorkbookChannel('wb-b'))

    expect(mockChannelFactory).toHaveBeenCalledTimes(2)
    expect(mockChannelFactory).toHaveBeenCalledWith('workbook:wb-a', expect.any(Object))
    expect(mockChannelFactory).toHaveBeenCalledWith('workbook:wb-b', expect.any(Object))

    hook1.unmount()
    hook2.unmount()
  })

  it('all hooks receive the same channel reference for the same workbookId', () => {
    const hook1 = renderHook(() => useWorkbookChannel('wb-same'))
    const hook2 = renderHook(() => useWorkbookChannel('wb-same'))

    // Both hooks should return the same channel object
    expect(hook1.result.current).not.toBeNull()
    expect(hook1.result.current).toBe(hook2.result.current)

    hook1.unmount()
    hook2.unmount()
  })

  it('unsubscribes the channel only when the LAST subscriber unmounts', () => {
    const hook1 = renderHook(() => useWorkbookChannel('wb-ref'))
    const hook2 = renderHook(() => useWorkbookChannel('wb-ref'))

    // Unmounting the first subscriber should NOT unsubscribe
    act(() => { hook1.unmount() })
    expect(mockChannel.unsubscribe).not.toHaveBeenCalled()

    // Unmounting the last subscriber SHOULD unsubscribe
    act(() => { hook2.unmount() })
    expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('creates a new channel if all subscribers unmounted and a new one mounts', () => {
    const hook1 = renderHook(() => useWorkbookChannel('wb-recycle'))
    act(() => { hook1.unmount() })

    // First mount created one channel
    expect(mockChannelFactory).toHaveBeenCalledTimes(1)

    // New subscriber after full teardown — should create a fresh channel
    const mockChannel2 = {
      ...mockChannel,
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    }
    mockChannelFactory.mockReturnValueOnce(mockChannel2)

    const hook2 = renderHook(() => useWorkbookChannel('wb-recycle'))
    expect(mockChannelFactory).toHaveBeenCalledTimes(2)
    expect(hook2.result.current).toBe(mockChannel2)

    hook2.unmount()
  })

  it('calls subscribe() on channel creation', () => {
    const { unmount } = renderHook(() => useWorkbookChannel('wb-sub'))
    expect(mockChannel.subscribe).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('returns null when workbookId is empty string', () => {
    const { result, unmount } = renderHook(() => useWorkbookChannel(''))
    // Empty workbookId → guard returns early, no channel created
    expect(mockChannelFactory).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
    unmount()
  })

  it('returns non-null channel after mount for a valid workbookId', () => {
    const { result, unmount } = renderHook(() => useWorkbookChannel('wb-valid'))
    // After renderHook, effects have been flushed by act()
    expect(result.current).not.toBeNull()
    expect(result.current).toBe(mockChannel)
    unmount()
  })
})
