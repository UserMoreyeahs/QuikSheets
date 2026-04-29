import Link from 'next/link'

export default function ConfirmPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">Email confirmed</h1>
        <p className="mb-6 text-sm text-zinc-500">Your Quiksheets account is ready to use.</p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  )
}
