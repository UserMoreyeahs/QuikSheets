'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { signUpAction } from '@/features/auth/actions'
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900">Create your Quiksheets account</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          Already a member?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>

        {success ? (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Check your email to confirm your account.
          </p>
        ) : (
          <>
            <GoogleSignInButton redirectTo="/dashboard" label="Sign up with Google" />

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200" />
              or
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

          <form
            action={(formData) => {
              setError(null)
              startTransition(async () => {
                const result = await signUpAction(formData)
                if (!result.ok) setError(result.error ?? 'Signup failed.')
                else setSuccess(true)
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
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
            >
              {pending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          </>
        )}
      </div>
    </main>
  )
}
