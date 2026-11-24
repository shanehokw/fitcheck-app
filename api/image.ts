// Vercel Function (Node.js runtime): POST /api/image {url} → image bytes
import { createImageHandler } from '../server/handlers.js'
import { resolveHost } from '../server/resolve.js'

const handle = createImageHandler({ resolveHost })

export function POST(request: Request): Promise<Response> {
  return handle(request)
}
