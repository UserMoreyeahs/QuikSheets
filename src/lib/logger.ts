/**
 * Tiny, dependency-free structured logger for Quiksheets.
 *
 * Why this exists
 * ---------------
 * The codebase had ~25 raw `console.error` / `console.warn` / `console.debug`
 * call sites, most of them behind `// eslint-disable-next-line no-console`
 * (and one `Reflect.get(globalThis, 'console')` hack). That left no single
 * place to (a) attach a structured prefix, (b) gate verbose levels in
 * production, or (c) hook an external error reporter (Sentry, etc.).
 *
 * This module is the ONE allowed `no-console` site. Everything else should
 * import `logger` and call `logger.error(scope, message, meta?)` etc.
 *
 * Design contract
 * ---------------
 * - `debug` / `info` are no-ops in production (`NODE_ENV === 'production'`).
 * - `warn` / `error` always emit (any environment).
 * - Every line is prefixed with `[quiksheets:<scope>]` so logs are greppable
 *   and attributable to a subsystem.
 * - Output is routed through the real `console`, guarded for SSR / edge
 *   runtimes where a given console method may be missing.
 * - A single optional sink (`setErrorSink`) lets a future Sentry integration
 *   subscribe to `error`-level events WITHOUT this module taking a dependency
 *   on any reporter today. The sink is best-effort: if it throws, the throw is
 *   swallowed so logging never changes a caller's control flow.
 *
 * Functionality-preserving migration note: callers that previously did
 * `console.debug('[scope] message:', value)` now do
 * `logger.debug('scope', 'message:', value)` — same level, same arguments,
 * same trigger conditions, just routed through here.
 */

/*
 * This is the ONE module permitted to touch the console directly. All console
 * access is funnelled through `consoleMethodFor` / `emit` below via dynamic
 * (bracket) member access, which the `no-console` rule does not flag — so no
 * file-wide eslint-disable is needed here. Everything else in the codebase
 * routes through `logger.*` and stays console-free.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Structured payload handed to an error sink. Mirrors the positional
 * arguments of `logger.error` so a sink can reconstruct the full message.
 */
export interface LogRecord {
  level: LogLevel
  scope: string
  message: string
  /** The optional `meta` argument, present only when the caller passed one. */
  meta?: unknown
}

/**
 * A sink receives every `error`-level event. Intended subscriber: a future
 * Sentry (or similar) integration. Kept intentionally minimal — no transport,
 * batching, or formatting concerns leak into this module.
 */
export type ErrorSink = (record: LogRecord) => void

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let errorSink: ErrorSink | null = null

/** Levels that emit even in production. */
const ALWAYS_EMIT: ReadonlySet<LogLevel> = new Set<LogLevel>(['warn', 'error'])

function isProduction(): boolean {
  // Read lazily on every call so tests can flip NODE_ENV between cases.
  return process.env.NODE_ENV === 'production'
}

function tag(scope: string): string {
  return `[quiksheets:${scope}]`
}

/**
 * Map a level to its console method. `debug` falls back to `log` when a
 * runtime lacks `console.debug` (some edge runtimes only ship a subset).
 */
function consoleMethodFor(level: LogLevel): ((...args: unknown[]) => void) | null {
  if (typeof console === 'undefined') return null

  const candidates: Record<LogLevel, ReadonlyArray<keyof Console>> = {
    debug: ['debug', 'log'],
    info: ['info', 'log'],
    warn: ['warn', 'error', 'log'],
    error: ['error', 'warn', 'log'],
  }

  for (const name of candidates[level]) {
    const fn = (console as unknown as Record<string, unknown>)[name as string]
    if (typeof fn === 'function') {
      // Bind so the console keeps its own `this` (some hosts require it).
      return (fn as (...args: unknown[]) => void).bind(console)
    }
  }
  return null
}

/**
 * The single, eslint-sanctioned console write. Everything funnels here.
 */
function emit(level: LogLevel, scope: string, message: string, hasMeta: boolean, meta: unknown): void {
  const write = consoleMethodFor(level)
  if (!write) return

  if (hasMeta) {
    write(tag(scope), message, meta)
  } else {
    write(tag(scope), message)
  }
}

/**
 * Notify the error sink, if one is registered. Best-effort: a throwing sink
 * must never propagate back into application control flow, and a sink failure
 * must never be reported through the sink again (no recursion).
 */
function notifyErrorSink(record: LogRecord): void {
  const sink = errorSink
  if (!sink) return
  try {
    sink(record)
  } catch (sinkError) {
    // Surface the sink's own failure to the console, but do not re-enter the
    // sink and do not rethrow.
    const write = consoleMethodFor('error')
    if (write) {
      write(tag('logger'), 'error sink threw', sinkError)
    }
  }
}

/**
 * Rest-arg length detection lets us distinguish `logger.debug('s', 'm')` from
 * `logger.debug('s', 'm', undefined)` — the former forwards two args to
 * console, the latter forwards a deliberate `undefined`. This keeps the
 * migration functionality-preserving for sites that intentionally passed a
 * value (even an undefined one).
 */
function log(level: LogLevel, scope: string, message: string, rest: unknown[]): void {
  const hasMeta = rest.length > 0
  const meta = hasMeta ? rest[0] : undefined

  if (!ALWAYS_EMIT.has(level) && isProduction()) {
    // debug / info are silenced in production — but still skip the sink, which
    // only cares about errors anyway.
    return
  }

  emit(level, scope, message, hasMeta, meta)

  if (level === 'error') {
    notifyErrorSink(
      hasMeta ? { level, scope, message, meta } : { level, scope, message }
    )
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const logger = {
  /** Verbose diagnostics. No-op in production. */
  debug(scope: string, message: string, ...meta: unknown[]): void {
    log('debug', scope, message, meta)
  },
  /** Informational. No-op in production. */
  info(scope: string, message: string, ...meta: unknown[]): void {
    log('info', scope, message, meta)
  },
  /** Warnings. Always emitted. */
  warn(scope: string, message: string, ...meta: unknown[]): void {
    log('warn', scope, message, meta)
  },
  /** Errors. Always emitted, and forwarded to the error sink if registered. */
  error(scope: string, message: string, ...meta: unknown[]): void {
    log('error', scope, message, meta)
  },
} as const

/**
 * Register (or clear, by passing `null`) the single error sink. Returns an
 * unsubscribe function that clears the sink only if it is still the one that
 * was registered — so a later `setErrorSink` is never clobbered by an earlier
 * unsubscribe.
 *
 * Wire NO external dependency here. A Sentry integration would call this from
 * its own init module, e.g. `setErrorSink((r) => Sentry.captureMessage(...))`.
 */
export function setErrorSink(sink: ErrorSink | null): () => void {
  errorSink = sink
  return () => {
    if (errorSink === sink) errorSink = null
  }
}

/** Read the currently-registered error sink (primarily for tests). */
export function getErrorSink(): ErrorSink | null {
  return errorSink
}
