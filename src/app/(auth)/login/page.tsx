'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signInAction } from '@/features/auth/actions'
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const params = useSearchParams()

  // Surface OAuth-callback errors (e.g., redirect-URL mismatch) so
  // users see why a Google sign-in attempt failed instead of staring
  // at a blank login form.
  useEffect(() => {
    const e = params?.get('error')
    if (!e) return
    const detail = params?.get('detail')
    setError(detail ? `${e}: ${detail}` : e.replace(/_/g, ' '))
  }, [params])

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900">Sign in to Quiksheets</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          New here?{' '}
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            Create an account
          </Link>
        </p>

        <GoogleSignInButton redirectTo="/dashboard" label="Sign in with Google" />

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200" />
          or
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <form
          action={(formData) => {
            setError(null)
            startTransition(async () => {
              const result = await signInAction(formData)
              if (!result.ok) setError(result.error ?? 'Sign in failed.')
            })
          }}
          className="space-y-4"
        >
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
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Link href="/reset" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
