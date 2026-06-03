/**
 * Contract tests for src/lib/logger.ts.
 *
 * Covered:
 *   1. error / warn always emit (dev AND production).
 *   2. debug / info emit in development.
 *   3. debug / info are no-ops in production.
 *   4. Every emitted line is prefixed with `[quiksheets:<scope>]`.
 *   5. The optional `meta` arg is forwarded to the console only when passed.
 *   6. setErrorSink receives error-level events (with scope/message/meta).
 *   7. The sink fires ONLY for error level (not warn/info/debug).
 *   8. setErrorSink(null) / the returned unsubscribe clears the sink.
 *   9. A throwing sink never propagates back to the caller.
 *  10. SSR/edge safety: missing console methods don't throw.
 */

/* eslint-disable no-console -- this suite spies on / mutates console directly to assert routing */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, setErrorSink, getErrorSink, type LogRecord } from '@/lib/logger'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

function setNodeEnv(value: string): void {
  // NODE_ENV is typed as readonly in some @types/node versions; assign through
  // a record cast so the test stays strict-clean.
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

describe('logger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let infoSpy: ReturnType<typeof vi.spyOn>
  let debugSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    setErrorSink(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setErrorSink(null)
    setNodeEnv(ORIGINAL_NODE_ENV ?? 'test')
  })

  // -------------------------------------------------------------------------
  // Always-emit levels
  // -------------------------------------------------------------------------
  it('error always emits, in development', () => {
    setNodeEnv('development')
    logger.error('sheetApi', 'load failed')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('error always emits, in production', () => {
    setNodeEnv('production')
    logger.error('sheetApi', 'load failed')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('warn always emits, in development', () => {
    setNodeEnv('development')
    logger.warn('cfRulesApi', 'rls deny')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('warn always emits, in production', () => {
    setNodeEnv('production')
    logger.warn('cfRulesApi', 'rls deny')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // Env-gated levels
  // -------------------------------------------------------------------------
  it('debug emits in development', () => {
    setNodeEnv('development')
    logger.debug('clipboard', 'copy failed')
    expect(debugSpy).toHaveBeenCalledTimes(1)
  })

  it('info emits in development', () => {
    setNodeEnv('development')
    logger.info('boot', 'ready')
    expect(infoSpy).toHaveBeenCalledTimes(1)
  })

  it('debug is a no-op in production', () => {
    setNodeEnv('production')
    logger.debug('clipboard', 'copy failed')
    expect(debugSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('info is a no-op in production', () => {
    setNodeEnv('production')
    logger.info('boot', 'ready')
    expect(infoSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Scope prefix
  // -------------------------------------------------------------------------
  it('prefixes output with [quiksheets:<scope>]', () => {
    setNodeEnv('development')
    logger.error('versionsApi', 'migration deferred')
    expect(errorSpy).toHaveBeenCalledWith('[quiksheets:versionsApi]', 'migration deferred')
  })

  it('prefix is present on warn too', () => {
    setNodeEnv('production')
    logger.warn('rowRlsApi', 'saveRule error')
    const firstArg = warnSpy.mock.calls[0]?.[0]
    expect(firstArg).toBe('[quiksheets:rowRlsApi]')
  })

  // -------------------------------------------------------------------------
  // Meta forwarding
  // -------------------------------------------------------------------------
  it('forwards the meta argument when provided', () => {
    setNodeEnv('development')
    const err = new Error('boom')
    logger.error('automation', 'dispatch failed', err)
    expect(errorSpy).toHaveBeenCalledWith('[quiksheets:automation]', 'dispatch failed', err)
  })

  it('omits the meta slot entirely when not provided', () => {
    setNodeEnv('development')
    logger.error('automation', 'dispatch failed')
    // Exactly two args — no trailing `undefined`.
    expect(errorSpy.mock.calls[0]).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // Error sink
  // -------------------------------------------------------------------------
  it('setErrorSink receives error-level events', () => {
    setNodeEnv('development')
    const records: LogRecord[] = []
    setErrorSink((r) => records.push(r))

    const meta = { code: 'PGRST301' }
    logger.error('sheetApi', 'save failed', meta)

    expect(records).toHaveLength(1)
    expect(records[0]).toEqual({
      level: 'error',
      scope: 'sheetApi',
      message: 'save failed',
      meta,
    })
  })

  it('sink receives errors even in production (where it matters most)', () => {
    setNodeEnv('production')
    const sink = vi.fn()
    setErrorSink(sink)
    logger.error('sheetApi', 'save failed')
    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('sink does NOT fire for warn / info / debug', () => {
    setNodeEnv('development')
    const sink = vi.fn()
    setErrorSink(sink)

    logger.warn('s', 'w')
    logger.info('s', 'i')
    logger.debug('s', 'd')

    expect(sink).not.toHaveBeenCalled()
  })

  it('setErrorSink(null) clears the sink', () => {
    const sink = vi.fn()
    setErrorSink(sink)
    setErrorSink(null)
    logger.error('s', 'm')
    expect(sink).not.toHaveBeenCalled()
    expect(getErrorSink()).toBeNull()
  })

  it('the returned unsubscribe clears only the matching sink', () => {
    const first = vi.fn()
    const unsubFirst = setErrorSink(first)
    const second = vi.fn()
    setErrorSink(second)

    // Unsubscribing the FIRST sink must not clear the SECOND.
    unsubFirst()
    expect(getErrorSink()).toBe(second)

    logger.error('s', 'm')
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('a throwing sink never propagates to the caller', () => {
    setNodeEnv('development')
    setErrorSink(() => {
      throw new Error('sink exploded')
    })

    // The logger.error call itself must not throw.
    expect(() => logger.error('s', 'm')).not.toThrow()
    // The original message still reached the console...
    expect(errorSpy).toHaveBeenCalledWith('[quiksheets:s]', 'm')
    // ...and the sink failure was reported (separately, via the logger scope).
    expect(
      errorSpy.mock.calls.some((c) => c[0] === '[quiksheets:logger]')
    ).toBe(true)
  })

  // -------------------------------------------------------------------------
  // SSR / edge safety
  // -------------------------------------------------------------------------
  it('does not throw when a console method is missing (edge runtime)', () => {
    setNodeEnv('development')
    // Simulate an edge runtime whose console lacks `debug` AND `log`.
    const realDebug = console.debug
    const realLog = console.log
    // @ts-expect-error — deliberately deleting for the test.
    delete (console as Record<string, unknown>).debug
    // @ts-expect-error — deliberately deleting for the test.
    delete (console as Record<string, unknown>).log

    try {
      expect(() => logger.debug('edge', 'no console.debug here')).not.toThrow()
    } finally {
      console.debug = realDebug
      console.log = realLog
    }
  })
})
