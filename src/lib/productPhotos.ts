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

/** Photo URLs found on a store product page. */
export async function findProductPhotos(productUrl: string): Promise<string[]> {
  const { images } = (await (await post('/api/product', productUrl)).json()) as { images: string[] }
  return images
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
