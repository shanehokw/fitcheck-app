import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { db } from './dexie/db'
import type { Look, LookPiece, Piece, Setting } from './types'

const FORMAT = 'fitcheck-backup'
const VERSION = 1

interface PhotoEntry {
  id: string
  type: string
  createdAt: number
  path: string
}

interface BackupData {
  format: typeof FORMAT
  version: number
  exportedAt: number
  looks: Look[]
  pieces: Piece[]
  lookPieces: LookPiece[]
  settings: Setting[]
  photos: PhotoEntry[]
}

export interface ImportResult {
  looks: number
  pieces: number
  photos: number
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

/** ZIP with data.json + photos/<id>.<ext>. Photos are stored without recompression. */
export async function exportBackup(): Promise<Blob> {
  const [looks, pieces, lookPieces, settings, photos] = await Promise.all([
    db.looks.toArray(),
    db.pieces.toArray(),
    db.lookPieces.toArray(),
    db.settings.toArray(),
    db.photos.toArray(),
  ])
  const files: Zippable = {}
  const photoEntries: PhotoEntry[] = []
  for (const p of photos) {
    const path = `photos/${p.id}.${EXT[p.blob.type] ?? 'bin'}`
    files[path] = [new Uint8Array(await p.blob.arrayBuffer()), { level: 0 }]
    photoEntries.push({ id: p.id, type: p.blob.type, createdAt: p.createdAt, path })
  }
  const data: BackupData = {
    format: FORMAT,
    version: VERSION,
    exportedAt: Date.now(),
    looks,
    pieces,
    lookPieces,
    settings,
    photos: photoEntries,
  }
  files['data.json'] = [strToU8(JSON.stringify(data)), { level: 6 }]
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

/**
 * replace: wipe everything, then load the backup.
 * merge: upsert by id; for looks and pieces the newer `updatedAt` wins; tag lists are unioned.
 */
export async function importBackup(file: Blob, mode: 'replace' | 'merge'): Promise<ImportResult> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('Not a valid backup file (cannot open ZIP).')
  }
  const raw = entries['data.json']
  if (!raw) throw new Error('Not a Fitcheck backup (data.json missing).')
  const data = JSON.parse(strFromU8(raw)) as BackupData
  if (data.format !== FORMAT) throw new Error('Not a Fitcheck backup.')
  if (data.version > VERSION) throw new Error('Backup is from a newer app version. Update the app first.')
  for (const k of ['looks', 'pieces', 'lookPieces', 'settings', 'photos'] as const) {
    if (!Array.isArray(data[k])) throw new Error(`Backup is damaged (${k} missing).`)
  }

  const photos = data.photos.map((p) => {
    const bytes = entries[p.path]
    if (!bytes) throw new Error(`Backup is damaged (photo ${p.path} missing).`)
    return { id: p.id, createdAt: p.createdAt, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: p.type }) }
  })

  await db.transaction('rw', [db.looks, db.pieces, db.lookPieces, db.photos, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([db.looks.clear(), db.pieces.clear(), db.lookPieces.clear(), db.photos.clear(), db.settings.clear()])
      await db.settings.bulkPut(data.settings)
      await db.looks.bulkPut(data.looks)
      await db.pieces.bulkPut(data.pieces)
    } else {
      await db.looks.bulkPut(await newerOnly(db.looks, data.looks))
      await db.pieces.bulkPut(await newerOnly(db.pieces, data.pieces))
      for (const s of data.settings) {
        const cur = await db.settings.get(s.key)
        if (cur && Array.isArray(cur.value) && Array.isArray(s.value)) {
          await db.settings.put({ key: s.key, value: [...new Set([...cur.value, ...s.value])] })
        } else if (!cur) {
          await db.settings.put(s)
        }
      }
    }
    await db.photos.bulkPut(photos)
    await db.lookPieces.bulkPut(data.lookPieces)
  })

  return { looks: data.looks.length, pieces: data.pieces.length, photos: photos.length }
}

async function newerOnly<T extends { id: string; updatedAt: number }>(
  table: { bulkGet(keys: string[]): Promise<(T | undefined)[]> },
  incoming: T[],
): Promise<T[]> {
  const existing = await table.bulkGet(incoming.map((r) => r.id))
  return incoming.filter((r, i) => !existing[i] || existing[i]!.updatedAt <= r.updatedAt)
}
