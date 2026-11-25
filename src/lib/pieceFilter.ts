import type { Piece, Status } from '../data/types'

export interface PieceFilter {
  q: string
  status: 'all' | Status
  category: string
  brand: string
  /** A piece must have every selected style. */
  styles: string[]
}

export const EMPTY_FILTER: PieceFilter = { q: '', status: 'all', category: '', brand: '', styles: [] }

/** Search matches name, brand, category and styles. All words must match (any order). Case-insensitive. */
export function matchesFilter(p: Piece, f: PieceFilter): boolean {
  if (f.status !== 'all' && p.status !== f.status) return false
  if (f.category && p.category !== f.category) return false
  if (f.brand && (p.brand ?? '').toLowerCase() !== f.brand.toLowerCase()) return false
  if (f.styles.some((s) => !p.styles.includes(s))) return false
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length) {
    const hay = [p.name, p.brand ?? '', p.category, ...p.styles].join(' ').toLowerCase()
    if (!words.every((w) => hay.includes(w))) return false
  }
  return true
}

/** Number of filters set, not counting search and status (for the "Filters (n)" button). */
export function extraFilterCount(f: PieceFilter): number {
  return (f.category ? 1 : 0) + (f.brand ? 1 : 0) + f.styles.length
}

/** Options taken from the pieces themselves, so only values in use are offered. Brands are de-duplicated ignoring case. */
export function filterOptions(pieces: Piece[]) {
  const brands = new Map<string, string>()
  for (const p of pieces) if (p.brand && !brands.has(p.brand.toLowerCase())) brands.set(p.brand.toLowerCase(), p.brand)
  const sort = (a: string, b: string) => a.localeCompare(b)
  return {
    categories: [...new Set(pieces.map((p) => p.category))].sort(sort),
    brands: [...brands.values()].sort(sort),
    styles: [...new Set(pieces.flatMap((p) => p.styles))].sort(sort),
  }
}

// Filters live in the address (?q=…&style=…), so they survive opening a piece and coming back.
export function filterFromParams(sp: URLSearchParams): PieceFilter {
  const status = sp.get('status')
  return {
    q: sp.get('q') ?? '',
    status: status === 'owned' || status === 'wanted' ? status : 'all',
    category: sp.get('category') ?? '',
    brand: sp.get('brand') ?? '',
    styles: sp.getAll('style'),
  }
}

export function filterToParams(f: PieceFilter): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.q) sp.set('q', f.q)
  if (f.status !== 'all') sp.set('status', f.status)
  if (f.category) sp.set('category', f.category)
  if (f.brand) sp.set('brand', f.brand)
  for (const s of f.styles) sp.append('style', s)
  return sp
}

/**
 * Brand suggestions while typing: names starting with the text first, then names containing it.
 * Case-insensitive. An exact match is left out (nothing to complete).
 */
export function suggestBrands(brands: string[], typed: string, limit = 3): string[] {
  const q = typed.trim().toLowerCase()
  if (!q) return []
  const others = brands.filter((b) => b.toLowerCase() !== q)
  const starts = others.filter((b) => b.toLowerCase().startsWith(q))
  const contains = others.filter((b) => !b.toLowerCase().startsWith(q) && b.toLowerCase().includes(q))
  return [...starts, ...contains].slice(0, limit)
}
