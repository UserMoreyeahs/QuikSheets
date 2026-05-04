'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Optional fallback UI. If omitted, a default "Something went wrong" panel is shown. */
  fallback?: React.ReactNode
  /** If true, the error is silently swallowed and nothing renders. Useful for optional overlays. */
  silent?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Generic React error boundary.
 *
 * Wrap any subtree that can crash independently — floating panels, chart
 * renderers, overlay layers, etc. — so the rest of the app keeps working.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.silent) {
      return null
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          Something went wrong
        </p>
        <p className="max-w-xs text-xs text-red-500 dark:text-red-500/80">
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false, error: null })}
          className="mt-1 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
        >
          Try again
        </button>
      </div>
    )
  }
}
