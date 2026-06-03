/**
 * SSRF guard tests — pins the deny/allow policy for server-side
 * outbound fetches used by /api/data/fetch.
 *
 * isBlockedIpv4 / isBlockedIpv6 / isBlockedAddress are pure and tested
 * directly. assertPublicHttpUrl is tested for the no-DNS paths (scheme,
 * blocked hostnames, literal IPs) — resolving real hostnames is left to
 * integration since it hits the network.
 */

import { describe, it, expect } from 'vitest'
import {
  isBlockedIpv4,
  isBlockedIpv6,
  isBlockedAddress,
  assertPublicHttpUrl,
  SsrfError,
} from '@/lib/ssrfGuard'

describe('isBlockedIpv4', () => {
  it('blocks loopback', () => {
    expect(isBlockedIpv4('127.0.0.1')).toBe(true)
    expect(isBlockedIpv4('127.255.255.254')).toBe(true)
  })
  it('blocks the cloud metadata address', () => {
    expect(isBlockedIpv4('169.254.169.254')).toBe(true)
  })
  it('blocks RFC1918 private ranges', () => {
    expect(isBlockedIpv4('10.0.0.1')).toBe(true)
    expect(isBlockedIpv4('172.16.0.1')).toBe(true)
    expect(isBlockedIpv4('172.31.255.255')).toBe(true)
    expect(isBlockedIpv4('192.168.1.1')).toBe(true)
  })
  it('blocks CGNAT and 0.0.0.0/8', () => {
    expect(isBlockedIpv4('100.64.0.1')).toBe(true)
    expect(isBlockedIpv4('0.0.0.0')).toBe(true)
  })
  it('allows public addresses', () => {
    expect(isBlockedIpv4('8.8.8.8')).toBe(false)
    expect(isBlockedIpv4('1.1.1.1')).toBe(false)
    expect(isBlockedIpv4('172.15.255.255')).toBe(false) // just below 172.16/12
    expect(isBlockedIpv4('172.32.0.0')).toBe(false)     // just above 172.16/12
  })
  it('fails closed on garbage', () => {
    expect(isBlockedIpv4('999.999.999.999')).toBe(true)
    expect(isBlockedIpv4('not-an-ip')).toBe(true)
  })
})

describe('isBlockedIpv6', () => {
  it('blocks loopback and unspecified', () => {
    expect(isBlockedIpv6('::1')).toBe(true)
    expect(isBlockedIpv6('::')).toBe(true)
  })
  it('blocks unique-local (fc00::/7) and link-local (fe80::/10)', () => {
    expect(isBlockedIpv6('fc00::1')).toBe(true)
    expect(isBlockedIpv6('fd12:3456::1')).toBe(true)
    expect(isBlockedIpv6('fe80::1')).toBe(true)
  })
  it('blocks IPv4-mapped private addresses', () => {
    expect(isBlockedIpv6('::ffff:127.0.0.1')).toBe(true)
    expect(isBlockedIpv6('::ffff:169.254.169.254')).toBe(true)
  })
  it('allows public IPv6', () => {
    expect(isBlockedIpv6('2606:4700:4700::1111')).toBe(false) // cloudflare
  })
})

describe('isBlockedAddress', () => {
  it('dispatches on family and fails closed on non-IPs', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
    expect(isBlockedAddress('::1')).toBe(true)
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    expect(isBlockedAddress('hostname.example.com')).toBe(true) // not an IP literal
  })
})

describe('assertPublicHttpUrl (no-DNS paths)', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicHttpUrl('ftp://example.com')).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicHttpUrl('gopher://example.com')).rejects.toBeInstanceOf(SsrfError)
  })
  it('rejects localhost hostnames', async () => {
    await expect(assertPublicHttpUrl('http://localhost:3000')).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicHttpUrl('http://foo.localhost')).rejects.toBeInstanceOf(SsrfError)
  })
  it('rejects cloud metadata hostname', async () => {
    await expect(assertPublicHttpUrl('http://metadata.google.internal/')).rejects.toBeInstanceOf(SsrfError)
  })
  it('rejects literal private/loopback/metadata IPs without DNS', async () => {
    await expect(assertPublicHttpUrl('http://127.0.0.1/')).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicHttpUrl('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicHttpUrl('http://10.0.0.5/')).rejects.toBeInstanceOf(SsrfError)
    await expect(assertPublicHttpUrl('http://[::1]/')).rejects.toBeInstanceOf(SsrfError)
  })
  it('rejects invalid URLs', async () => {
    await expect(assertPublicHttpUrl('not a url')).rejects.toBeInstanceOf(SsrfError)
  })
  it('allows a literal public IP', async () => {
    const u = await assertPublicHttpUrl('https://8.8.8.8/resolve')
    expect(u.protocol).toBe('https:')
    expect(u.hostname).toBe('8.8.8.8')
  })
})
