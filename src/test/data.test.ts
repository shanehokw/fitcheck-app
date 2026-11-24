import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../data/backup'
import { db } from '../data/dexie/db'
import { getPhoto } from '../data/photos'
import {
  createLook, createPiece, deleteLook, deletePiece, getLook, linkPiece,
  listLookSummaries, listPieces, updatePiece,
} from '../data/repo'
import { isComplete } from '../lib/looks'
import { computeStats } from '../lib/stats'

const photo = (s = 'img') => new Blob([new TextEncoder().encode(s)], { type: 'image/webp' })
const piece = (name: string, category: string, styles: string[], status: 'owned' | 'wanted' = 'owned') =>
  createPiece({ name, category, styles, status })

describe('isComplete', () => {
  it('needs at least one piece, all owned', () => {
    expect(isComplete([])).toBe(false)
    expect(isComplete([{ status: 'owned' }, { status: 'wanted' }])).toBe(false)
    expect(isComplete([{ status: 'owned' }, { status: 'owned' }])).toBe(true)
  })
})

describe('repository', () => {
  it('reuses a piece across looks and reflects status changes in both', async () => {
    const a = await createLook({ photo: photo('a') })
    const b = await createLook({ photo: photo('b') })
    const skirt = await piece('Black pencil skirt', 'skirt', ['pencil'], 'wanted')
    await linkPiece(a, skirt)
    await linkPiece(b, skirt)
    expect((await getLook(a))!.complete).toBe(false)

    await updatePiece(skirt, { status: 'owned' })
    const looks = await listLookSummaries()
    expect(looks.map((l) => l.complete)).toEqual([true, true])
    expect((await listPieces())[0].lookCount).toBe(2)
  })

  it('uses string UUID ids', async () => {
    const id = await piece('Tee', 'top', [])
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('deleteLook removes links and photo, keeps pieces', async () => {
    const a = await createLook({ photo: photo() })
    const p = await piece('Tee', 'top', [])
    await linkPiece(a, p)
    const photoId = (await getLook(a))!.look.photoId
    await deleteLook(a)
    expect(await getLook(a)).toBeNull()
    expect(await getPhoto(photoId)).toBeUndefined()
    expect(await db.lookPieces.count()).toBe(0)
    expect(await db.pieces.count()).toBe(1)
  })

  it('deletePiece removes its links', async () => {
    const a = await createLook({ photo: photo() })
    const p = await piece('Tee', 'top', [])
    await linkPiece(a, p)
    await deletePiece(p)
    expect((await getLook(a))!.pieces).toEqual([])
  })
})

describe('computeStats', () => {
  it('counts each look once per tag', async () => {
    const skirt = await piece('Pencil skirt', 'skirt', ['pencil', 'formal'])
    const skirt2 = await piece('Grey pencil skirt', 'skirt', ['pencil'])
    const jeans = await piece('Jeans', 'jeans', ['denim'])
    const l1 = await createLook({ photo: photo() })
    const l2 = await createLook({ photo: photo() })
    const l3 = await createLook({ photo: photo() })
    await linkPiece(l1, skirt)
    await linkPiece(l1, skirt2)
    await linkPiece(l2, skirt2)
    await linkPiece(l3, jeans)

    const s = computeStats(await listLookSummaries())
    expect(s.totalLooks).toBe(3)
    expect(s.categories[0]).toEqual({ tag: 'skirt', count: 2 })
    expect(s.styles[0]).toEqual({ tag: 'pencil', count: 2 })
    expect(s.combos[0]).toEqual({ tag: 'pencil skirt', count: 2 })
  })
})

describe('backup', () => {
  it('round-trips data and photo bytes (replace)', async () => {
    const l = await createLook({ photo: photo('hello-photo'), title: 'Office' })
    const p = await piece('Pencil skirt', 'skirt', ['pencil'])
    await linkPiece(l, p)
    const zip = await exportBackup()

    await Promise.all(db.tables.map((t) => t.clear()))
    const res = await importBackup(zip, 'replace')
    expect(res).toEqual({ looks: 1, pieces: 1, collections: 0, photos: 1 })

    const back = (await getLook(l))!
    expect(back.look.title).toBe('Office')
    expect(back.pieces[0].name).toBe('Pencil skirt')
    const blob = (await getPhoto(back.look.photoId))!
    expect(new TextDecoder().decode(await blob.arrayBuffer())).toBe('hello-photo')
    expect(blob.type).toBe('image/webp')
  })

  it('merge keeps newer local edits', async () => {
    const p = await piece('Old name', 'top', [])
    const zip = await exportBackup()
    await new Promise((r) => setTimeout(r, 5))
    await updatePiece(p, { name: 'New name' })
    await importBackup(zip, 'merge')
    expect((await db.pieces.get(p))!.name).toBe('New name')
  })

  it('rejects non-backup files', async () => {
    await expect(importBackup(new Blob(['nope']), 'merge')).rejects.toThrow(/valid backup/)
  })
})

describe('replaceLookPhoto', () => {
  it('swaps the photo and deletes the old one', async () => {
    const { replaceLookPhoto } = await import('../data/repo')
    const l = await createLook({ photo: photo('old') })
    const oldId = (await getLook(l))!.look.photoId
    await replaceLookPhoto(l, photo('new'))
    const look = (await getLook(l))!.look
    expect(look.photoId).not.toBe(oldId)
    expect(await getPhoto(oldId)).toBeUndefined()
    expect(new TextDecoder().decode(await (await getPhoto(look.photoId))!.arrayBuffer())).toBe('new')
    expect(await db.photos.count()).toBe(1)
  })
})

describe('collections', () => {
  it('requires a name', async () => {
    const { createCollection } = await import('../data/repo')
    await expect(createCollection({ name: '   ' })).rejects.toThrow(/name is required/)
  })

  it('links looks many-to-many and previews the newest look without a cover', async () => {
    const { createCollection, addLookToCollection, listCollections, getCollection, collectionIdsForLook } = await import('../data/repo')
    const l1 = await createLook({ photo: photo() })
    await new Promise((r) => setTimeout(r, 2))
    const l2 = await createLook({ photo: photo() })
    const a = await createCollection({ name: ' Tokyo ' })
    const b = await createCollection({ name: 'Work' })
    await addLookToCollection(l1, a)
    await addLookToCollection(l2, a)
    await addLookToCollection(l1, b)

    const list = await listCollections()
    const tokyo = list.find((c) => c.collection.id === a)!
    expect(tokyo.collection.name).toBe('Tokyo')
    expect(tokyo.lookCount).toBe(2)
    expect(tokyo.previewPhotoId).toBe((await getLook(l2))!.look.photoId)
    expect((await getCollection(a))!.looks).toHaveLength(2)
    expect((await collectionIdsForLook(l1)).sort()).toEqual([a, b].sort())
  })

  it('cover: set, replace (old deleted), remove', async () => {
    const { createCollection, setCollectionCover } = await import('../data/repo')
    const c = await createCollection({ name: 'Summer', cover: photo('c1') })
    const first = (await db.collections.get(c))!.coverPhotoId!
    expect(first).toBeTruthy()
    await setCollectionCover(c, photo('c2'))
    const second = (await db.collections.get(c))!.coverPhotoId!
    expect(await getPhoto(first)).toBeUndefined()
    await setCollectionCover(c, null)
    expect((await db.collections.get(c))!.coverPhotoId).toBeUndefined()
    expect(await getPhoto(second)).toBeUndefined()
    expect(await db.photos.count()).toBe(0)
  })

  it('deleting a collection keeps its looks; deleting a look removes its links', async () => {
    const { createCollection, addLookToCollection, deleteCollection } = await import('../data/repo')
    const l = await createLook({ photo: photo() })
    const c = await createCollection({ name: 'A', cover: photo() })
    await addLookToCollection(l, c)
    await deleteCollection(c)
    expect(await getLook(l)).not.toBeNull()
    expect(await db.lookCollections.count()).toBe(0)
    expect(await db.photos.count()).toBe(1)

    const c2 = await createCollection({ name: 'B' })
    await addLookToCollection(l, c2)
    await deleteLook(l)
    expect(await db.lookCollections.count()).toBe(0)
    expect(await db.collections.count()).toBe(1)
  })

  it('backup round-trips collections and covers', async () => {
    const { createCollection, addLookToCollection, getCollection } = await import('../data/repo')
    const l = await createLook({ photo: photo('look') })
    const c = await createCollection({ name: 'Trip', cover: photo('cover') })
    await addLookToCollection(l, c)
    const zip = await exportBackup()
    await Promise.all(db.tables.map((t) => t.clear()))
    const res = await importBackup(zip, 'replace')
    expect(res.collections).toBe(1)
    const back = (await getCollection(c))!
    expect(back.collection.name).toBe('Trip')
    expect(back.looks.map((s) => s.look.id)).toEqual([l])
    const cover = (await getPhoto(back.collection.coverPhotoId!))!
    expect(new TextDecoder().decode(await cover.arrayBuffer())).toBe('cover')
  })

  it('imports a version 1 backup that has no collections', async () => {
    const { strToU8, zipSync } = await import('fflate')
    const t = Date.now()
    const v1 = {
      format: 'fitcheck-backup', version: 1, exportedAt: t,
      looks: [{ id: 'l1', photoId: 'p1', title: '', notes: '', createdAt: t, updatedAt: t }],
      pieces: [], lookPieces: [], settings: [],
      photos: [{ id: 'p1', type: 'image/webp', createdAt: t, path: 'photos/p1.webp' }],
    }
    const zip = zipSync({ 'data.json': strToU8(JSON.stringify(v1)), 'photos/p1.webp': strToU8('x') })
    const res = await importBackup(new Blob([zip as Uint8Array<ArrayBuffer>]), 'replace')
    expect(res).toEqual({ looks: 1, pieces: 0, collections: 0, photos: 1 })
    expect(await getLook('l1')).not.toBeNull()
  })
})

describe('piece photos', () => {
  it('create with photo, replace, remove, delete piece cleans up', async () => {
    const id = await createPiece({ name: 'Skirt', category: 'skirt', styles: [], status: 'owned' }, photo('p1'))
    const first = (await db.pieces.get(id))!.photoId!
    expect(await getPhoto(first)).toBeDefined()

    await updatePiece(id, { name: 'Skirt 2' }, photo('p2'))
    const second = (await db.pieces.get(id))!.photoId!
    expect(await getPhoto(first)).toBeUndefined()

    await updatePiece(id, { name: 'Skirt 3' })
    expect((await db.pieces.get(id))!.photoId).toBe(second)

    await updatePiece(id, {}, null)
    expect((await db.pieces.get(id))!.photoId).toBeUndefined()
    expect(await db.photos.count()).toBe(0)

    await updatePiece(id, {}, photo('p3'))
    await deletePiece(id)
    expect(await db.photos.count()).toBe(0)
  })
})
