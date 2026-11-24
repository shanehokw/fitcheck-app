// Node-only DNS lookup used by the Vercel functions. Kept out of handlers.ts so that file stays host-neutral.
import { lookup } from 'node:dns/promises'
import type { ResolveHost } from './net.js'

export const resolveHost: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((r) => r.address)
