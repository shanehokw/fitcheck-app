import { isComplete } from '../lib/looks'
import { db } from './dexie/db'
import { deletePhoto, putPhoto } from './photos'
import type { Look, LookSummary, Piece, PieceInput, TagLists } from './types'

const now = () => Date.now()
const newId = () => crypto.randomUUID()

export const DEFAULT_TAGS: TagLists = {
  categories: [
    'top', 'shirt', 'knitwear', 'skirt', 'pants', 'jeans', 'shorts', 'dress',
    'jumpsuit', 'outerwear', 'shoes', 'bag', 'accessory',
  ],
  styles: [
    'pencil', 'a-line', 'pleated', 'mini', 'midi', 'maxi', 'wide-leg', 'straight',
    'cropped', 'oversized', 'fitted', 'denim', 'linen', 'knit', 'leather', 'satin',
    'floral', 'striped', 'plain', 'casual', 'formal', 'vintage', 'streetwear',
  ],
}

// ---------- looks ----------

export async function createLook(input: { photo: Blob; title?: string; notes?: string }): Promise<string> {
  const id = newId()
  const t = now()
  await db.transaction('rw', db.looks, db.photos, async () => {
    const photoId = await putPhoto(input.photo)
    await db.looks.add({ id, photoId, title: input.title ?? '', notes: input.notes ?? '', createdAt: t, updatedAt: t })
  })
  return id
}

export async function updateLook(id: string, patch: Partial<Pick<Look, 'title' | 'notes'>>): Promise<void> {
  await db.looks.update(id, { ...patch, updatedAt: now() })
}

export async function deleteLook(id: string): Promise<void> {
  await db.transaction('rw', db.looks, db.lookPieces, db.photos, async () => {
    const look = await db.looks.get(id)
    if (!look) return
    await db.lookPieces.where('lookId').equals(id).delete()
    await deletePhoto(look.photoId)
    await db.looks.delete(id)
  })
}

export async function getLook(id: string): Promise<LookSummary | null> {
  const look = await db.looks.get(id)
  if (!look) return null
  const links = await db.lookPieces.where('lookId').equals(id).sortBy('createdAt')
  const pieces = (await db.pieces.bulkGet(links.map((l) => l.pieceId))).filter((p): p is Piece => !!p)
  return { look, pieces, complete: isComplete(pieces) }
}

export async function listLookSummaries(): Promise<LookSummary[]> {
  const [looks, links, pieces] = await Promise.all([
    db.looks.orderBy('createdAt').reverse().toArray(),
    db.lookPieces.toArray(),
    db.pieces.toArray(),
  ])
  const pieceById = new Map(pieces.map((p) => [p.id, p]))
  const byLook = new Map<string, Piece[]>()
  for (const l of links) {
    const p = pieceById.get(l.pieceId)
    if (!p) continue
    const arr = byLook.get(l.lookId) ?? []
    arr.push(p)
    byLook.set(l.lookId, arr)
  }
  return looks.map((look) => {
    const ps = byLook.get(look.id) ?? []
    return { look, pieces: ps, complete: isComplete(ps) }
  })
}

// ---------- pieces ----------

export async function createPiece(input: PieceInput): Promise<string> {
  const id = newId()
  const t = now()
  await db.pieces.add({ ...cleanPiece(input), id, createdAt: t, updatedAt: t })
  return id
}

export async function updatePiece(id: string, patch: Partial<PieceInput>): Promise<void> {
  await db.pieces.update(id, { ...cleanPiece(patch), updatedAt: now() })
}

export async function deletePiece(id: string): Promise<void> {
  await db.transaction('rw', db.pieces, db.lookPieces, async () => {
    await db.lookPieces.where('pieceId').equals(id).delete()
    await db.pieces.delete(id)
  })
}

export async function getPiece(id: string): Promise<{ piece: Piece; looks: Look[] } | null> {
  const piece = await db.pieces.get(id)
  if (!piece) return null
  const links = await db.lookPieces.where('pieceId').equals(id).toArray()
  const looks = (await db.looks.bulkGet(links.map((l) => l.lookId))).filter((l): l is Look => !!l)
  return { piece, looks }
}

export async function listPieces(): Promise<(Piece & { lookCount: number })[]> {
  const [pieces, links] = await Promise.all([db.pieces.orderBy('name').toArray(), db.lookPieces.toArray()])
  const counts = new Map<string, number>()
  for (const l of links) counts.set(l.pieceId, (counts.get(l.pieceId) ?? 0) + 1)
  return pieces.map((p) => ({ ...p, lookCount: counts.get(p.id) ?? 0 }))
}

export async function linkPiece(lookId: string, pieceId: string): Promise<void> {
  await db.lookPieces.put({ lookId, pieceId, createdAt: now() })
}

export async function unlinkPiece(lookId: string, pieceId: string): Promise<void> {
  await db.lookPieces.delete([lookId, pieceId])
}

function cleanPiece<T extends Partial<PieceInput>>(p: T): T {
  const out = { ...p }
  if (out.name !== undefined) out.name = out.name.trim()
  if (out.styles) out.styles = [...new Set(out.styles)]
  if (out.productUrl !== undefined) out.productUrl = out.productUrl.trim() || undefined
  return out
}

// ---------- settings ----------

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getTagLists(): Promise<TagLists> {
  return {
    categories: await getSetting('categories', DEFAULT_TAGS.categories),
    styles: await getSetting('styles', DEFAULT_TAGS.styles),
  }
}

export async function setTagList(kind: keyof TagLists, values: string[]): Promise<void> {
  const clean = [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))]
  await setSetting(kind, clean)
}
