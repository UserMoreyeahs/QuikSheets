/**
 * /api/data/fetch — server-side proxy for Insert > Data > From Web.
 *
 * Why a proxy and not a client-side fetch?
 *   - Many public CSV/JSON endpoints don't set CORS headers, so the
 *     browser blocks them.
 *   - Server-side fetch sidesteps CORS entirely.
 *   - We can cap response size + content-type up front, which prevents
 *     us from accidentally piping a 4 GB binary into the user's tab.
 *
 * Security:
 *   - REQUIRES an authenticated Supabase session (Bearer token). The
 *     "From Web" dialog attaches it. Without this the route was an
 *     UNAUTHENTICATED SSRF vector.
 *   - SSRF guard: the target URL must resolve to a public address.
 *     Loopback / RFC1918 / link-local (incl. 169.254.169.254 cloud
 *     metadata) are rejected. See src/lib/ssrfGuard.ts.
 *   - Redirects are followed MANUALLY and the guard re-runs on every
 *     hop, so a public URL can't 302 us onto a private one.
 *   - Only http/https schemes
 *   - Cap response size at 5 MB
 *   - 8 second timeout
 *   - Do NOT forward user cookies/headers (only Accept + User-Agent)
 */

import { NextResponse } from 'next/server'
import { authenticateSheetRequest } from '@/lib/sheetApi'
import { assertPublicHttpUrl, SsrfError } from '@/lib/ssrfGuard'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 5

interface FetchRequest {
  url?: string
}

/**
 * Fetch following redirects manually, re-running the SSRF guard on each
 * hop. Returns the final non-redirect Response.
 */
async function fetchWithSsrfGuard(
  startUrl: URL,
  signal: AbortSignal,
): Promise<Response> {
  let current = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // Re-validate every hop (the first was validated by the caller, but
    // redirect targets are attacker-influenced).
    await assertPublicHttpUrl(current.toString())

    const resp = await fetch(current, {
      method: 'GET',
      headers: {
        // Most servers prefer a real-looking UA. Some refuse cloud-function
        // bots; pretending to be a browser-ish client keeps the success rate
        // higher without doing anything sketchy.
        'User-Agent': 'Mozilla/5.0 (compatible; QuiksheetsBot/1.0)',
        'Accept': 'text/csv, application/json, text/plain, */*',
      },
      redirect: 'manual',
      signal,
    })

    const isRedirect = resp.status >= 300 && resp.status < 400
    const location = resp.headers.get('location')
    if (isRedirect && location) {
      try {
        current = new URL(location, current)
      } catch {
        throw new SsrfError('Upstream sent an invalid redirect location.', 502)
      }
      continue
    }
    return resp
  }
  throw new SsrfError('Too many redirects.', 502)
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Require an authenticated session. The "From Web" dialog sends the
  //    Supabase access token as a Bearer header.
  const auth = await authenticateSheetRequest(req)
  if ('response' in auth) {
    // authenticateSheetRequest returns a plain Response; rewrap as
    // NextResponse for the declared return type.
    const body = await auth.response.json().catch(() => ({ error: 'Unauthorized' }))
    return NextResponse.json(body, { status: auth.response.status })
  }

  let body: FetchRequest
  try {
    body = (await req.json()) as FetchRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = (body.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  // 2. SSRF guard on the initial URL.
  let parsed: URL
  try {
    parsed = await assertPublicHttpUrl(url)
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetchWithSsrfGuard(parsed, controller.signal)

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    const reader = upstream.body?.getReader()
    if (!reader) {
      return NextResponse.json({ error: 'Empty response body' }, { status: 502 })
    }

    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > MAX_BYTES) {
        try { reader.cancel() } catch { /* ignore */ }
        return NextResponse.json({ error: `Response exceeds ${MAX_BYTES} bytes` }, { status: 413 })
      }
      chunks.push(value)
    }

    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    const text = new TextDecoder('utf-8').decode(merged)

    return NextResponse.json({
      url: parsed.toString(),
      contentType,
      bytes: received,
      text,
    })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'unknown error'
    if (/aborted/i.test(msg)) {
      return NextResponse.json({ error: `Timed out after ${TIMEOUT_MS} ms` }, { status: 504 })
    }
    return NextResponse.json({ error: `Upstream fetch failed: ${msg}` }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
