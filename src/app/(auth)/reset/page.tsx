'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { requestPasswordResetAction, completePasswordResetAction } from '@/features/auth/actions'

export default function ResetPage() {
  // Two modes: request (default) or complete (when user lands from email link with type=recovery in url).
  const isComplete = typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900">
          {isComplete ? 'Set a new password' : 'Reset your password'}
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>

        {success ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {isComplete ? 'Password updated.' : 'Check your email for the reset link.'}
          </p>
        ) : (
          <form
            action={(formData) => {
              setError(null)
              startTransition(async () => {
                const result = isComplete
                  ? await completePasswordResetAction(formData)
                  : await requestPasswordResetAction(formData)
                if (!result.ok) setError(result.error ?? 'Reset failed.')
                else setSuccess(true)
              })
            }}
            className="space-y-4"
          >
            {isComplete ? (
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
            >
              {pending ? 'Working…' : isComplete ? 'Update password' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
