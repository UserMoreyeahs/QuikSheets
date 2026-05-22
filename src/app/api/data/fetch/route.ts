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
 *   - Only allow http/https schemes
 *   - Cap response size at 5 MB
 *   - 8 second timeout
 *   - Do NOT forward user cookies/headers (only Accept + User-Agent)
 */

import { NextResponse } from 'next/server'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const TIMEOUT_MS = 8000

interface FetchRequest {
  url?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: FetchRequest
  try {
    body = await req.json() as FetchRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = (body.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) URLs are allowed' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        // Most servers prefer a real-looking UA. Some refuse cloud-function
        // bots; pretending to be a browser-ish client keeps the success rate
        // higher without doing anything sketchy.
        'User-Agent': 'Mozilla/5.0 (compatible; QuiksheetsBot/1.0)',
        'Accept': 'text/csv, application/json, text/plain, */*',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

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
    const msg = err instanceof Error ? err.message : 'unknown error'
    if (/aborted/i.test(msg)) {
      return NextResponse.json({ error: `Timed out after ${TIMEOUT_MS} ms` }, { status: 504 })
    }
    return NextResponse.json({ error: `Upstream fetch failed: ${msg}` }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
