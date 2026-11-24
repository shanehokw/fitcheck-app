// Finds product photo URLs in a store page. Pure functions: no network.

const MAX_IMAGES = 12

/** Ordered, de-duplicated absolute image URLs. Product gallery (JSON-LD) first, then meta tags. */
export function extractImageUrls(html: string, pageUrl: URL): string[] {
  const found: string[] = []
  found.push(...jsonLdImages(html))
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag)
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase()
    if (['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src', 'image'].includes(key) && a.content) {
      found.push(a.content)
    }
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag)
    if ((a.rel ?? '').toLowerCase().split(/\s+/).includes('image_src') && a.href) found.push(a.href)
  }
  return normalize(found, pageUrl)
}

/** Shopify product JSON (/products/<handle>.json) when the page looks like a Shopify product. */
export function shopifyJsonUrl(html: string, pageUrl: URL): string | null {
  if (!/cdn\.shopify\.com|Shopify\.shop|shopify-section/i.test(html)) return null
  const m = pageUrl.pathname.match(/^(.*\/products\/[^/?#.]+)/)
  return m ? `${pageUrl.origin}${m[1]}.json` : null
}

export function shopifyImages(json: unknown, pageUrl: URL): string[] {
  const images = (json as { product?: { images?: { src?: unknown }[] } })?.product?.images
  if (!Array.isArray(images)) return []
  return normalize(images.map((i) => i?.src).filter((s): s is string => typeof s === 'string'), pageUrl)
}

/**
 * Same photo at another size or address counts once: the key is the last folder + file name,
 * with size suffixes (_600x, @2x) removed and query ignored. The first (usually full-size) one is kept.
 */
export function photoKey(u: URL): string {
  const parts = u.pathname.toLowerCase().split('/').filter(Boolean)
  const file = (parts.pop() ?? '').replace(/(_\d+x\d*|_x\d+|@\dx)(?=\.[a-z0-9]+$)/, '')
  return `${parts.pop() ?? ''}/${file}`
}

export function normalize(urls: string[], base: URL): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    try {
      const u = new URL(decodeEntities(raw.trim()), base)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
      const key = photoKey(u)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(u.toString())
    } catch {
      // skip bad URL
    }
    if (out.length >= MAX_IMAGES) break
  }
  return out
}

function jsonLdImages(html: string): string[] {
  const out: string[] = []
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    let data: unknown
    try {
      data = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    walk(data, out, 0)
  }
  return out
}

function walk(node: unknown, out: string[], depth: number) {
  if (depth > 8 || node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const n of node) walk(n, out, depth + 1)
    return
  }
  const obj = node as Record<string, unknown>
  const types = ([] as unknown[]).concat(obj['@type'] ?? []).map(String)
  if (types.some((t) => t === 'Product' || t === 'ProductGroup' || t === 'IndividualProduct')) collectImage(obj.image, out)
  for (const k of ['@graph', 'hasVariant', 'mainEntity', 'itemListElement', 'item']) walk(obj[k], out, depth + 1)
}

function collectImage(v: unknown, out: string[]) {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => collectImage(x, out))
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    collectImage(o.url ?? o.contentUrl, out)
  }
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x2f;/gi, '/')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}
