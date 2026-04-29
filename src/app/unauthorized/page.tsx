import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">Access denied</h1>
        <p className="mb-6 text-sm text-zinc-500">
          You do not have permission to view this resource. The owner can grant you access from the
          Share dialog.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}
