import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Sign in is not wired yet</h1>
          <p className="text-sm text-zinc-500">
            The spreadsheet app is available locally, but the dedicated authentication flow has not
            been connected yet.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
