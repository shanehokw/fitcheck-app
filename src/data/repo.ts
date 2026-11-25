import { isComplete } from '../lib/looks'
import { db } from './dexie/db'
import { deletePhoto, putPhoto } from './photos'
import type { Collection, CollectionSummary, Look, LookSummary, Piece, PieceInput, TagLists } from './types'

const now = () => Date.now()

/** Manual order first (sortOrder), then rows never reordered, by name. */
const byManualOrder = <T extends { sortOrder?: number; name: string }>(a: T, b: T) =>
  (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.name.localeCompare(b.name)
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

export async function createLook(input: { photo: Blob }): Promise<string> {
  const id = newId()
  const t = now()
  await db.transaction('rw', db.looks, db.photos, async () => {
    const photoId = await putPhoto(input.photo)
    await db.looks.add({ id, photoId, createdAt: t, updatedAt: t })
  })
  return id
}

export async function deleteLook(id: string): Promise<void> {
  await db.transaction('rw', [db.looks, db.lookPieces, db.lookCollections, db.photos], async () => {
    const look = await db.looks.get(id)
    if (!look) return
    await db.lookPieces.where('lookId').equals(id).delete()
    await db.lookCollections.where('lookId').equals(id).delete()
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

export async function createPiece(input: PieceInput, photo?: Blob): Promise<string> {
  const id = newId()
  const t = now()
  await db.transaction('rw', db.pieces, db.photos, async () => {
    const photoId = photo ? await putPhoto(photo) : undefined
    await db.pieces.add({ ...cleanPiece(input), photoId, id, createdAt: t, updatedAt: t })
  })
  return id
}

/** photo: a Blob replaces the piece photo, null removes it, undefined leaves it. Old photos are deleted. */
export async function updatePiece(id: string, patch: Partial<PieceInput>, photo?: Blob | null): Promise<void> {
  await db.transaction('rw', db.pieces, db.photos, async () => {
    const changes: Partial<Piece> = { ...cleanPiece(patch), updatedAt: now() }
    if (photo !== undefined) {
      const old = (await db.pieces.get(id))?.photoId
      changes.photoId = photo ? await putPhoto(photo) : undefined
      if (old) await deletePhoto(old)
    }
    await db.pieces.update(id, changes)
  })
}

export async function deletePiece(id: string): Promise<void> {
  await db.transaction('rw', db.pieces, db.lookPieces, db.photos, async () => {
    const piece = await db.pieces.get(id)
    await db.lookPieces.where('pieceId').equals(id).delete()
    if (piece?.photoId) await deletePhoto(piece.photoId)
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
  const [pieces, links] = await Promise.all([db.pieces.toArray(), db.lookPieces.toArray()])
  pieces.sort(byManualOrder)
  const counts = new Map<string, number>()
  for (const l of links) counts.set(l.pieceId, (counts.get(l.pieceId) ?? 0) + 1)
  return pieces.map((p) => ({ ...p, lookCount: counts.get(p.id) ?? 0 }))
}

/** Saves the given order: ids[0] first. Ids not listed keep their place after these. */
export async function reorderPieces(ids: string[]): Promise<void> {
  const t = now()
  await db.transaction('rw', db.pieces, async () => {
    for (const [i, id] of ids.entries()) await db.pieces.update(id, { sortOrder: i, updatedAt: t })
  })
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
  if (out.brand !== undefined) out.brand = out.brand.trim() || undefined
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

// ---------- photo replacement ----------

/** Swap a look's photo (for example after cropping). The old photo is deleted. */
export async function replaceLookPhoto(lookId: string, photo: Blob): Promise<void> {
  await db.transaction('rw', db.looks, db.photos, async () => {
    const look = await db.looks.get(lookId)
    if (!look) throw new Error('Look not found')
    const photoId = await putPhoto(photo)
    await db.looks.update(lookId, { photoId, updatedAt: now() })
    await deletePhoto(look.photoId)
  })
}

// ---------- collections ----------

function cleanName(name: string): string {
  const n = name.trim()
  if (!n) throw new Error('Collection name is required')
  return n
}

export async function createCollection(input: { name: string; cover?: Blob }): Promise<string> {
  const id = newId()
  const t = now()
  const name = cleanName(input.name)
  await db.transaction('rw', db.collections, db.photos, async () => {
    const coverPhotoId = input.cover ? await putPhoto(input.cover) : undefined
    await db.collections.add({ id, name, coverPhotoId, createdAt: t, updatedAt: t })
  })
  return id
}

export async function renameCollection(id: string, name: string): Promise<void> {
  await db.collections.update(id, { name: cleanName(name), updatedAt: now() })
}

/** Set a new cover photo, or pass null to remove it. The old cover photo is deleted. */
export async function setCollectionCover(id: string, cover: Blob | null): Promise<void> {
  await db.transaction('rw', db.collections, db.photos, async () => {
    const c = await db.collections.get(id)
    if (!c) throw new Error('Collection not found')
    const coverPhotoId = cover ? await putPhoto(cover) : undefined
    await db.collections.update(id, { coverPhotoId, updatedAt: now() })
    if (c.coverPhotoId) await deletePhoto(c.coverPhotoId)
  })
}

/** Deletes the collection and its cover photo. Looks stay. */
export async function deleteCollection(id: string): Promise<void> {
  await db.transaction('rw', [db.collections, db.lookCollections, db.photos], async () => {
    const c = await db.collections.get(id)
    if (!c) return
    await db.lookCollections.where('collectionId').equals(id).delete()
    if (c.coverPhotoId) await deletePhoto(c.coverPhotoId)
    await db.collections.delete(id)
  })
}

/** Saves the given order: ids[0] first. */
export async function reorderCollections(ids: string[]): Promise<void> {
  const t = now()
  await db.transaction('rw', db.collections, async () => {
    for (const [i, id] of ids.entries()) await db.collections.update(id, { sortOrder: i, updatedAt: t })
  })
}

export async function addLookToCollection(lookId: string, collectionId: string): Promise<void> {
  await db.lookCollections.put({ lookId, collectionId, createdAt: now() })
}

export async function removeLookFromCollection(lookId: string, collectionId: string): Promise<void> {
  await db.lookCollections.delete([lookId, collectionId])
}

export async function listCollections(): Promise<CollectionSummary[]> {
  const [collections, links, looks] = await Promise.all([
    db.collections.toArray(),
    db.lookCollections.toArray(),
    db.looks.toArray(),
  ])
  collections.sort(byManualOrder)
  const lookById = new Map(looks.map((l) => [l.id, l]))
  return collections.map((collection) => {
    const inIt = links
      .filter((l) => l.collectionId === collection.id)
      .map((l) => lookById.get(l.lookId))
      .filter((l): l is Look => !!l)
      .sort((a, b) => b.createdAt - a.createdAt)
    return { collection, lookCount: inIt.length, previewPhotoId: collection.coverPhotoId ?? inIt[0]?.photoId }
  })
}

export async function getCollection(id: string): Promise<{ collection: Collection; looks: LookSummary[] } | null> {
  const collection = await db.collections.get(id)
  if (!collection) return null
  const lookIds = new Set((await db.lookCollections.where('collectionId').equals(id).toArray()).map((l) => l.lookId))
  const looks = (await listLookSummaries()).filter((s) => lookIds.has(s.look.id))
  return { collection, looks }
}

/** Ids of the collections a look belongs to. */
export async function collectionIdsForLook(lookId: string): Promise<string[]> {
  return (await db.lookCollections.where('lookId').equals(lookId).toArray()).map((l) => l.collectionId)
}
