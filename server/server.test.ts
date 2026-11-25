import { beforeEach, describe, expect, it } from 'vitest'
import { extractDetails, extractImageUrls, shopifyJsonUrl } from './extract.js'
import { createImageHandler, createProductHandler, MAX_IMAGE, resetRateLimit } from './handlers.js'
import { isPrivateIp, validateTargetUrl } from './net.js'

const page = new URL('https://shop.example.com/products/skirt?variant=1')

describe('extractImageUrls', () => {
  it('reads JSON-LD gallery first, then og/twitter/link; resolves and de-duplicates', () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/a.jpg?w=1&amp;h=2">
      <meta name="twitter:image" content="/b.jpg">
      <link rel="image_src" href="//cdn.example.com/c.jpg">
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Product","image":[
          "https://cdn.example.com/g1.jpg",{"@type":"ImageObject","url":"https://cdn.example.com/g2.jpg"}]}]}
      </script>
      <meta property="og:image" content="https://cdn.example.com/g1.jpg">`
    expect(extractImageUrls(html, page)).toEqual([
      'https://cdn.example.com/g1.jpg',
      'https://cdn.example.com/g2.jpg',
      'https://cdn.example.com/a.jpg?w=1&h=2',
      'https://shop.example.com/b.jpg',
      'https://cdn.example.com/c.jpg',
    ])
  })

  it('merges the same photo at different sizes and hosts', () => {
    const html = `
      <meta property="og:image" content="https://cdn.shopify.com/s/files/1/files/SKIRT_FRONT.png?v=1">
      <meta property="og:image" content="https://shop.example.com/cdn/shop/files/SKIRT_FRONT.png?v=1&width=300">
      <meta property="og:image" content="https://shop.example.com/cdn/shop/files/SKIRT_FRONT_600x.png">
      <meta property="og:image" content="https://shop.example.com/cdn/shop/files/SKIRT_BACK.png">`
    expect(extractImageUrls(html, page)).toEqual([
      'https://cdn.shopify.com/s/files/1/files/SKIRT_FRONT.png?v=1',
      'https://shop.example.com/cdn/shop/files/SKIRT_BACK.png',
    ])
  })

  it('ignores broken JSON-LD and non-http URLs', () => {
    const html = `<script type="application/ld+json">{oops</script><meta property="og:image" content="javascript:alert(1)">`
    expect(extractImageUrls(html, page)).toEqual([])
  })

  it('detects Shopify product JSON', () => {
    expect(shopifyJsonUrl('<script src="https://cdn.shopify.com/x.js">', page)).toBe('https://shop.example.com/products/skirt.json')
    expect(shopifyJsonUrl('<html>', page)).toBeNull()
  })
})

describe('extractDetails', () => {
  it('prefers JSON-LD Product name and brand object', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Linen &amp; Cotton Shirt","brand":{"@type":"Brand","name":"Acme"}}]}</script>
      <meta property="og:title" content="Other">`
    expect(extractDetails(html)).toEqual({ name: 'Linen & Cotton Shirt', brand: 'Acme' })
  })

  it('falls back to meta tags and strips the site name from og:title', () => {
    const html = `<meta property="og:title" content="Wide Leg Jeans | Denim Co"><meta property="og:site_name" content="Denim Co">
      <meta property="product:brand" content="Denim Co">`
    expect(extractDetails(html)).toEqual({ name: 'Wide Leg Jeans', brand: 'Denim Co' })
  })

  it('returns nothing when the page has no product data', () => {
    expect(extractDetails('<html><title>x</title></html>')).toEqual({ name: undefined, brand: undefined })
  })
})

describe('address blocking', () => {
  it.each([
    ['127.0.0.1', true], ['10.1.2.3', true], ['172.20.0.1', true], ['192.168.1.1', true], ['169.254.169.254', true],
    ['100.64.0.1', true], ['0.0.0.0', true], ['::1', true], ['::', true], ['fd00::1', true], ['fe80::1', true],
    ['::ffff:127.0.0.1', true], ['::ffff:7f00:1', true], ['64:ff9b::a9fe:a9fe', true],
    ['8.8.8.8', false], ['172.32.0.1', false], ['2606:4700::1111', false],
  ])('isPrivateIp(%s) = %s', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected)
  })

  it.each([
    'ftp://example.com/a', 'http://localhost/x', 'http://foo.local/x', 'http://127.0.0.1/', 'http://[::1]/',
    'http://user:pw@example.com/', 'http://example.com:8080/', 'http://intranet/', 'not a url',
  ])('rejects %s', (u) => {
    expect(() => validateTargetUrl(u)).toThrow()
  })

  it('accepts a normal store link', () => {
    expect(validateTargetUrl('https://www.example.com/p/1').hostname).toBe('www.example.com')
  })
})

// ---- handlers with fake network ----

type Route = (url: URL) => Response
function fakeFetch(routes: Record<string, Route>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input))
    const r = routes[url.toString()]
    return r ? r(url) : new Response('nope', { status: 404 })
  }) as typeof fetch
}
const publicDns = async () => ['93.184.216.34']
const req = (path: string, url: string, headers: Record<string, string> = {}) =>
  new Request(`https://fitcheck.vercel.app${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers },
    body: JSON.stringify({ url }),
  })

describe('product handler', () => {
  beforeEach(resetRateLimit)

  it('returns found photos, Shopify gallery first', async () => {
    const handler = createProductHandler({
      resolveHost: publicDns,
      fetchImpl: fakeFetch({
        'https://shop.example.com/products/skirt?variant=1': () =>
          new Response('<script src="//cdn.shopify.com/s.js"></script><meta property="og:image" content="https://cdn.example.com/og.jpg">', { headers: { 'content-type': 'text/html' } }),
        'https://shop.example.com/products/skirt.json': () =>
          Response.json({ product: { title: 'Pleated Skirt', vendor: 'Acme', images: [{ src: 'https://cdn.shopify.com/1.jpg' }, { src: 'https://cdn.shopify.com/2.jpg' }] } }),
      }),
    })
    const res = await handler(req('/api/product', page.toString()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      images: ['https://cdn.shopify.com/1.jpg', 'https://cdn.shopify.com/2.jpg', 'https://cdn.example.com/og.jpg'],
      name: 'Pleated Skirt',
      brand: 'Acme',
    })
  })

  it('reads only the start of very large pages', async () => {
    const big = '<meta property="og:image" content="https://cdn.example.com/top.jpg">' + 'x'.repeat(4 * 1024 * 1024)
    const handler = createProductHandler({ resolveHost: publicDns, fetchImpl: fakeFetch({ 'https://shop.example.com/big': () => new Response(big) }) })
    const res = await handler(req('/api/product', 'https://shop.example.com/big'))
    expect(await res.json()).toEqual({ images: ['https://cdn.example.com/top.jpg'] })
  })

  it('blocks hosts that resolve to private addresses', async () => {
    const handler = createProductHandler({ resolveHost: async () => ['10.0.0.5'], fetchImpl: fakeFetch({}) })
    const res = await handler(req('/api/product', 'https://evil.example.com/'))
    expect(res.status).toBe(400)
  })

  it('re-checks redirects', async () => {
    const handler = createProductHandler({
      resolveHost: publicDns,
      fetchImpl: fakeFetch({
        'https://shop.example.com/r': () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }),
      }),
    })
    expect((await handler(req('/api/product', 'https://shop.example.com/r'))).status).toBe(400)
  })

  it('rejects calls from other sites and non-POST', async () => {
    const handler = createProductHandler({ resolveHost: publicDns, fetchImpl: fakeFetch({}) })
    expect((await handler(req('/api/product', page.toString(), { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
    expect((await handler(req('/api/product', page.toString(), { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await handler(new Request('https://fitcheck.vercel.app/api/product'))).status).toBe(405)
  })

  it('rate limits per client', async () => {
    const handler = createProductHandler({ resolveHost: publicDns, fetchImpl: fakeFetch({}) })
    let last = 0
    for (let i = 0; i < 61; i++) last = (await handler(req('/api/product', 'https://shop.example.com/x', { 'x-forwarded-for': '1.2.3.4' }))).status
    expect(last).toBe(429)
  })
})

describe('image handler', () => {
  beforeEach(resetRateLimit)
  const img = 'https://cdn.example.com/a.jpg'

  it('passes through images with safe headers', async () => {
    const handler = createImageHandler({
      resolveHost: publicDns,
      fetchImpl: fakeFetch({ [img]: () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }) }),
    })
    const res = await handler(req('/api/image', img))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'")
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('rejects non-images (including SVG) and oversized files', async () => {
    const handler = createImageHandler({
      resolveHost: publicDns,
      fetchImpl: fakeFetch({
        [img]: () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
        'https://cdn.example.com/x.svg': () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
        'https://cdn.example.com/big.jpg': () => new Response(new Uint8Array(MAX_IMAGE + 1), { headers: { 'content-type': 'image/jpeg' } }),
      }),
    })
    expect((await handler(req('/api/image', img))).status).toBe(415)
    expect((await handler(req('/api/image', 'https://cdn.example.com/x.svg'))).status).toBe(415)
    expect((await handler(req('/api/image', 'https://cdn.example.com/big.jpg'))).status).toBe(413)
  })
})
