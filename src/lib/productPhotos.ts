// Client side of the product photo feature. Links go in the POST body, never the URL,
// so they do not show up in host request logs.

async function post(path: string, url: string): Promise<Response> {
  if (!navigator.onLine) throw new Error('You are offline. Upload your own photo instead.')
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  } catch {
    throw new Error('Could not reach the Fitcheck server.')
  }
  if (!res.ok) {
    const msg = await res.json().then((b: { error?: string }) => b.error).catch(() => undefined)
    throw new Error(msg ?? `Request failed (${res.status})`)
  }
  return res
}

export interface ProductInfo {
  images: string[]
  name?: string
  brand?: string
}

// One lookup per link per app session: filling name/brand and "Photos from link" share it.
const cache = new Map<string, Promise<ProductInfo>>()

/** Name, brand and photo URLs found on a store product page. */
export function findProduct(productUrl: string): Promise<ProductInfo> {
  const key = productUrl.trim()
  let p = cache.get(key)
  if (!p) {
    p = post('/api/product', key).then((r) => r.json() as Promise<ProductInfo>)
    p.catch(() => cache.delete(key)) // failures are not cached, so a retry fetches again
    cache.set(key, p)
  }
  return p
}

/** Photo URLs found on a store product page. */
export async function findProductPhotos(productUrl: string): Promise<string[]> {
  return (await findProduct(productUrl)).images
}

/** Downloads one store photo through the server (the browser cannot read other sites' images directly). */
export async function downloadProductPhoto(imageUrl: string): Promise<Blob> {
  return (await post('/api/image', imageUrl)).blob()
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
