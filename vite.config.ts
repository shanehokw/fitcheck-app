import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer, defineConfig, type Connect, type Plugin, type ViteDevServer } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import vercel from './vercel.json' with { type: 'json' }

// Same CSP as production (vercel.json), so `npm run preview` tests it locally.
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy')!.value

/** Runs /api/*.ts (the Vercel Functions) inside `vite dev` and `vite preview`, so no Vercel CLI is needed locally. */
function apiRoutes(): Plugin {
  let loader: ViteDevServer | undefined
  const middleware = (getLoader: () => Promise<ViteDevServer>): Connect.NextHandleFunction =>
    async (req: IncomingMessage, res: ServerResponse, next) => {
      const name = req.url?.match(/^\/api\/(product|image)(?:\?|$)/)?.[1]
      if (!name) return next()
      try {
        const mod = (await (await getLoader()).ssrLoadModule(`/api/${name}.ts`)) as Record<string, (r: Request) => Promise<Response>>
        const handler = mod[req.method ?? 'GET']
        if (!handler) {
          res.statusCode = 405
          return res.end()
        }
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const body = chunks.length ? Buffer.concat(chunks) : undefined
        const response = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body }))
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (e) {
        next(e)
      }
    }
  return {
    name: 'fitcheck-api-routes',
    configureServer(server) {
      server.middlewares.use(middleware(async () => server))
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        middleware(async () => (loader ??= await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true } }))),
      )
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    apiRoutes(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fitcheck',
        short_name: 'Fitcheck',
        description: 'Catalogue your outfits. Private, on your phone.',
        theme_color: '#b5523b',
        background_color: '#faf7f5',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Never answer /api calls from the offline cache.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  preview: { headers: { 'Content-Security-Policy': CSP } },
})
