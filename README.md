# Fitcheck

Outfit cataloguer PWA. Data stays on the device (IndexedDB). See `HANDOFF.md`.

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (data, stats, backup) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve build with production CSP (and `/api`) |

## Code rules
- UI reads and writes data only through `src/data/hooks.ts` and `src/data/repo.ts`. Only `src/data/` imports Dexie.
- IDs are UUID strings. Every row has `createdAt` / `updatedAt`.
- CSP and security headers live in `vercel.json`. `vite.config.ts` reads them for local preview.
- Server code: `server/` is host-neutral (standard Request/Response). `api/*.ts` are thin Vercel entry points.
  `vite dev` and `vite preview` run `/api` locally, so the Vercel CLI is not needed.

## Server functions (product photos)
| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/product` | `{"url": "<store product page>"}` | `{"images": [...]}` (max 12) |
| `POST /api/image` | `{"url": "<image>"}` | image bytes (jpeg/png/webp/avif/gif, max 4 MB) |

Safety: public http(s) only, ports 80/443, private/internal addresses blocked (re-checked on each redirect),
same-site callers only, ~60 requests/min per IP per instance, nothing logged or stored.

## Deploy (Vercel)
Import the GitHub repo in Vercel. Framework preset Vite; `vercel.json` sets build `npm run build`, output `dist`.
Turn on 2FA on GitHub and Vercel.
