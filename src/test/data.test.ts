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
    expect(res).toEqual({ looks: 1, pieces: 1, photos: 1 })

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
