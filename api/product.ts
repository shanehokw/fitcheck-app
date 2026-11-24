// Vercel Function (Node.js runtime): POST /api/product {url} → {images}
import { createProductHandler } from '../server/handlers.js'
import { resolveHost } from '../server/resolve.js'

const handle = createProductHandler({ resolveHost })

export function POST(request: Request): Promise<Response> {
  return handle(request)
}
