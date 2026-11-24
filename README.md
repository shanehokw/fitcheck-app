# Fitcheck

Outfit cataloguer PWA. Data stays on the device (IndexedDB). See `HANDOFF.md`.

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (data, stats, backup) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve build with production CSP |

## Code rules
- UI reads and writes data only through `src/data/hooks.ts` and `src/data/repo.ts`. Only `src/data/` imports Dexie.
- IDs are UUID strings. Every row has `createdAt` / `updatedAt`.
- CSP lives in `public/_headers` and `vite.config.ts`. Keep them the same.

## Deploy (Cloudflare Pages)
Build command `npm run build`, output folder `dist`. Turn on 2FA on GitHub and Cloudflare.
