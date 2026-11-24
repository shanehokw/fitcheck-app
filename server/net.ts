// Host-neutral network safety helpers. No Node or Vercel imports here, so the same code
// can run on another host later. DNS lookup is passed in by the caller.

export type ResolveHost = (hostname: string) => Promise<string[]>

export class FetchBlockedError extends Error {}
export class TooLargeError extends Error {}

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|intranet|home|lan|corp)$/i

/** Throws FetchBlockedError unless the URL is a public http(s) address on a normal port. */
export function validateTargetUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new FetchBlockedError('Not a valid link')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchBlockedError('Only http and https links work')
  if (url.username || url.password) throw new FetchBlockedError('Links with a login are not allowed')
  if (url.port && url.port !== '80' && url.port !== '443') throw new FetchBlockedError('Unusual port')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !host.includes(':')) throw new FetchBlockedError('Not a public address')
  if (BLOCKED_NAMES.test(host)) throw new FetchBlockedError('Not a public address')
  if (isIpLiteral(host) && isPrivateIp(host)) throw new FetchBlockedError('Not a public address')
  return url
}

export function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')
}

/** True for loopback, private, link-local, carrier-grade NAT, multicast, reserved and similar ranges. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) return isPrivateV6(ip)
  const n = v4ToInt(ip)
  if (n === null) return true
  const inRange = (base: string, bits: number) => {
    const b = v4ToInt(base)!
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return ((n & mask) >>> 0) === ((b & mask) >>> 0)
  }
  return [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
    ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
    ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
  ].some(([b, bits]) => inRange(b as string, bits as number))
}

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function isPrivateV6(ip: string): boolean {
  const g = expandV6(ip.toLowerCase().split('%')[0])
  if (!g) return true
  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true // :: and ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-translated (64:ff9b::/96): check the embedded IPv4.
  const embedded = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateIp(embedded)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateIp(embedded)
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation
  return false
}

function expandV6(ip: string): number[] | null {
  let s = ip
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const n = v4ToInt(v4[1])
    if (n === null) return null
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0
  const all = [...head, ...Array(Math.max(0, fill)).fill('0'), ...tail]
  if (all.length !== 8) return null
  const nums = all.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN))
  return nums.some(Number.isNaN) ? null : nums
}

export interface SafeFetchOptions {
  accept: string
  timeoutMs: number
  maxRedirects?: number
  fetchImpl?: typeof fetch
  resolveHost: ResolveHost
  userAgent: string
}

/**
 * fetch() that re-checks every redirect hop: public http(s) only, and the hostname must not
 * resolve to a private address. Remaining risk: DNS can change between our lookup and fetch's
 * own lookup (DNS rebinding). Acceptable here; the response is only ever an image or page text.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions): Promise<{ response: Response; finalUrl: URL }> {
  const doFetch = opts.fetchImpl ?? fetch
  let url = validateTargetUrl(raw)
  for (let hop = 0; hop <= (opts.maxRedirects ?? 4); hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (!isIpLiteral(host)) {
      const ips = await opts.resolveHost(host).catch(() => [])
      if (ips.length === 0) throw new FetchBlockedError('Could not find that website')
      if (ips.some(isPrivateIp)) throw new FetchBlockedError('Not a public address')
    }
    const response = await doFetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { accept: opts.accept, 'user-agent': opts.userAgent, 'accept-language': 'en' },
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel()
      url = validateTargetUrl(new URL(location, url).toString())
      continue
    }
    return { response, finalUrl: url }
  }
  throw new FetchBlockedError('Too many redirects')
}

/**
 * Reads the body up to maxBytes. Past that: throws TooLargeError, or with truncate=true
 * returns the first maxBytes (enough for page metadata, which sits near the top).
 */
export async function readLimited(response: Response, maxBytes: number, truncate = false): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes && !truncate) {
    await response.body?.cancel()
    throw new TooLargeError('Too large')
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (total + value.byteLength > maxBytes) {
      await reader.cancel()
      if (!truncate) throw new TooLargeError('Too large')
      chunks.push(value.subarray(0, maxBytes - total))
      total = maxBytes
      break
    }
    total += value.byteLength
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}
