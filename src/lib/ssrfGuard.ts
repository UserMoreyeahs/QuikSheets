/**
 * SSRF guard for server-side outbound fetches.
 *
 * Any route that fetches a user-supplied URL on the server (e.g.
 * `/api/data/fetch` — the "From Web" import) is an SSRF vector: without
 * a guard, a caller can point it at `http://169.254.169.254/…` (cloud
 * metadata), `http://127.0.0.1:…` (loopback services), or RFC1918
 * private ranges and read internal responses through our server.
 *
 * `assertPublicHttpUrl` validates a URL is:
 *   1. http(s) only
 *   2. not an obviously-internal hostname (localhost, *.localhost,
 *      cloud metadata hostnames)
 *   3. resolving ONLY to public unicast addresses (DNS is resolved and
 *      every returned address is range-checked)
 *
 * Residual risk: DNS rebinding (host resolves public here, private at
 * connect time) is NOT fully closed — that needs connecting to the
 * pinned IP with a Host header, which Node's fetch doesn't expose
 * ergonomically. Callers should additionally use `redirect: 'manual'`
 * and re-run this guard on every redirect hop (see `/api/data/fetch`).
 */

import net from 'node:net'
import { lookup } from 'node:dns/promises'

/** Thrown when a URL fails the SSRF policy. Carries an HTTP-friendly status. */
export class SsrfError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'SsrfError'
    this.status = status
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    n = (n << 8) | octet
  }
  return n >>> 0
}

/** True if an IPv4 dotted-quad is in any private / reserved / non-public range. */
export function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → fail closed
  const inRange = (base: string, maskBits: number): boolean => {
    const b = ipv4ToInt(base)
    if (b === null) return false
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) ||      // "this" network
    inRange('10.0.0.0', 8) ||     // private
    inRange('100.64.0.0', 10) ||  // CGNAT
    inRange('127.0.0.0', 8) ||    // loopback
    inRange('169.254.0.0', 16) || // link-local incl. 169.254.169.254 metadata
    inRange('172.16.0.0', 12) ||  // private
    inRange('192.0.0.0', 24) ||   // IETF protocol assignments
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) ||  // benchmarking
    inRange('224.0.0.0', 4) ||    // multicast
    inRange('240.0.0.0', 4)       // reserved
  )
}

/** True if an IPv6 address is loopback / link-local / unique-local / mapped-private. */
export function isBlockedIpv6(ip: string): boolean {
  const addr = (ip.split('%')[0] ?? '').toLowerCase() // strip zone id
  if (addr === '::1' || addr === '::') return true

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible — check the embedded v4.
  const mapped = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mapped?.[1]) return isBlockedIpv4(mapped[1])

  const firstHextet = addr.startsWith('::') ? 0 : parseInt(addr.split(':')[0] ?? '', 16)
  if (!Number.isNaN(firstHextet)) {
    const high8 = (firstHextet >> 8) & 0xff
    if (high8 === 0xfc || high8 === 0xfd) return true // fc00::/7 unique-local
    if ((firstHextet & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  }
  return false
}

/** True if a resolved address (either family) is non-public. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) return isBlockedIpv4(address)
  if (family === 6) return isBlockedIpv6(address)
  return true // not a valid IP literal → fail closed
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
])

/**
 * Validate that `rawUrl` is a public http(s) URL safe to fetch
 * server-side. Returns the parsed URL on success; throws SsrfError
 * otherwise.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new SsrfError('Invalid URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfError('Only http(s) URLs are allowed.')
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) {
    throw new SsrfError('That host is not allowed.', 403)
  }

  // Literal IP in the URL → check directly, no DNS.
  const literalFamily = net.isIP(host)
  if (literalFamily !== 0) {
    if (isBlockedAddress(host)) {
      throw new SsrfError('That address is not allowed.', 403)
    }
    return parsed
  }

  // Hostname → resolve every address and check each.
  let resolved: { address: string }[]
  try {
    resolved = await lookup(host, { all: true })
  } catch {
    throw new SsrfError('Could not resolve host.', 502)
  }
  if (resolved.length === 0) {
    throw new SsrfError('Could not resolve host.', 502)
  }
  for (const { address } of resolved) {
    if (isBlockedAddress(address)) {
      throw new SsrfError('That host resolves to a private or reserved address.', 403)
    }
  }

  return parsed
}
