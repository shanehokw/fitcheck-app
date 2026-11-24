import type { LookSummary } from '../data/types'

export interface TagCount {
  tag: string
  count: number
}

export interface StyleStats {
  totalLooks: number
  completeLooks: number
  categories: TagCount[]
  styles: TagCount[]
  /** style + category pairs, e.g. "pencil skirt" */
  combos: TagCount[]
}

/** Counts looks per tag. A look counts once per tag, however many pieces carry it. */
export function computeStats(summaries: LookSummary[]): StyleStats {
  const cat = new Map<string, number>()
  const sty = new Map<string, number>()
  const combo = new Map<string, number>()
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

  for (const { pieces } of summaries) {
    const c = new Set<string>()
    const s = new Set<string>()
    const cs = new Set<string>()
    for (const p of pieces) {
      if (p.category) c.add(p.category)
      for (const st of p.styles) {
        s.add(st)
        if (p.category) cs.add(`${st} ${p.category}`)
      }
    }
    c.forEach((k) => bump(cat, k))
    s.forEach((k) => bump(sty, k))
    cs.forEach((k) => bump(combo, k))
  }

  const sorted = (m: Map<string, number>) =>
    [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

  return {
    totalLooks: summaries.length,
    completeLooks: summaries.filter((s) => s.complete).length,
    categories: sorted(cat),
    styles: sorted(sty),
    combos: sorted(combo),
  }
}
