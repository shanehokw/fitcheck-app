// Request handlers using standard Request/Response, so they run on Vercel now and on
// other hosts later. Nothing is logged or stored.
import { extractImageUrls, normalize, shopifyImages, shopifyJsonUrl } from './extract.js'
import { FetchBlockedError, readLimited, safeFetch, TooLargeError, type ResolveHost } from './net.js'

export interface Deps {
  resolveHost: ResolveHost
  fetchImpl?: typeof fetch
}

const UA = 'Mozilla/5.0 (compatible; FitcheckLinkPreview/1.0)'
const MAX_HTML = 3 * 1024 * 1024
const MAX_JSON = 1024 * 1024
/** Below Vercel's ~4.5 MB response limit. */
export const MAX_IMAGE = 4 * 1024 * 1024
const IMAGE_TYPES = /^image\/(jpeg|png|webp|avif|gif)\b/i

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })

// ---- request checks ----

/** Only the app's own pages may call these endpoints. Not real auth: stops casual reuse from other sites. */
function checkCaller(req: Request): Response | null {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' })
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return json(415, { error: 'JSON only' })
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return json(403, { error: 'Forbidden' })
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) return json(403, { error: 'Forbidden' })
    } catch {
      return json(403, { error: 'Forbidden' })
    }
  }
  if (!rateLimitOk(clientKey(req))) return json(429, { error: 'Too many requests. Wait a minute.' })
  return null
}

// Best effort: counts per server instance only (Vercel may run several).
const WINDOW_MS = 60_000
const LIMIT = 60
const hits = new Map<string, { start: number; count: number }>()
function rateLimitOk(key: string): boolean {
  const t = Date.now()
  const h = hits.get(key)
  if (!h || t - h.start > WINDOW_MS) {
    hits.set(key, { start: t, count: 1 })
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start > WINDOW_MS) hits.delete(k)
    return true
  }
  h.count++
  return h.count <= LIMIT
}
export function resetRateLimit() {
  hits.clear()
}
function clientKey(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown').split(',')[0].trim()
}

async function readUrl(req: Request): Promise<string | Response> {
  try {
    const body = (await req.json()) as { url?: unknown }
    if (typeof body.url !== 'string' || body.url.length > 2048) return json(400, { error: 'Send a link' })
    return body.url
  } catch {
    return json(400, { error: 'Send a link' })
  }
}

function failure(e: unknown): Response {
  if (e instanceof FetchBlockedError) return json(400, { error: e.message })
  if (e instanceof TooLargeError) return json(413, { error: 'The file is too large' })
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return json(504, { error: 'The store took too long to answer' })
  return json(502, { error: 'Could not reach the store' })
}

// ---- POST /api/product {url} → {images: string[]} ----

export function createProductHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    const bad = checkCaller(req)
    if (bad) return bad
    const url = await readUrl(req)
    if (url instanceof Response) return url
    try {
      const { response, finalUrl } = await safeFetch(url, {
        ...deps,
        accept: 'text/html,application/xhtml+xml',
        timeoutMs: 8000,
        userAgent: UA,
      })
      if (!response.ok) {
        await response.body?.cancel()
        return json(502, { error: `The store answered with an error (${response.status})` })
      }
      const html = new TextDecoder().decode(await readLimited(response, MAX_HTML, true))
      let images: string[] = []
      const shopify = shopifyJsonUrl(html, finalUrl)
      if (shopify) {
        try {
          const r = await safeFetch(shopify, { ...deps, accept: 'application/json', timeoutMs: 5000, userAgent: UA })
          if (r.response.ok) images = shopifyImages(JSON.parse(new TextDecoder().decode(await readLimited(r.response, MAX_JSON))), finalUrl)
          else await r.response.body?.cancel()
        } catch {
          // fall back to the page itself
        }
      }
      return json(200, { images: normalize([...images, ...extractImageUrls(html, finalUrl)], finalUrl) })
    } catch (e) {
      return failure(e)
    }
  }
}

// ---- POST /api/image {url} → image bytes ----

export function createImageHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    const bad = checkCaller(req)
    if (bad) return bad
    const url = await readUrl(req)
    if (url instanceof Response) return url
    try {
      const { response } = await safeFetch(url, {
        ...deps,
        accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8',
        timeoutMs: 8000,
        userAgent: UA,
      })
      if (!response.ok) {
        await response.body?.cancel()
        return json(502, { error: `The store answered with an error (${response.status})` })
      }
      const type = response.headers.get('content-type') ?? ''
      if (!IMAGE_TYPES.test(type)) {
        await response.body?.cancel()
        return json(415, { error: 'That link is not a photo' })
      }
      const bytes = await readLimited(response, MAX_IMAGE)
      return new Response(bytes as Uint8Array<ArrayBuffer>, {
        status: 200,
        headers: {
          'content-type': type.split(';')[0],
          'cache-control': 'private, max-age=3600',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'",
        },
      })
    } catch (e) {
      return failure(e)
    }
  }
}
