import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { db } from './dexie/db'
import type { Collection, Look, LookCollection, LookPiece, Piece, Setting } from './types'

const FORMAT = 'fitcheck-backup'

/** Settings that describe this phone, not the data. Not exported, and kept when a backup is imported. */
export const BACKUP_SETTING = { lastAt: 'lastBackupAt', snoozedUntil: 'backupReminderSnoozedUntil' } as const
const DEVICE_KEYS = [BACKUP_SETTING.lastAt, BACKUP_SETTING.snoozedUntil, 'installBannerDismissed']
const isDeviceKey = (k: string) => DEVICE_KEYS.includes(k)
/** 1: looks, pieces. 2: adds collections. Older backups still import. */
const VERSION = 2

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
  collections?: Collection[]
  lookCollections?: LookCollection[]
}

export interface ImportResult {
  looks: number
  pieces: number
  collections: number
  photos: number
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

/** ZIP with data.json + photos/<id>.<ext>. Photos are stored without recompression. */
export async function exportBackup(): Promise<Blob> {
  const [looks, pieces, lookPieces, settings, photos, collections, lookCollections] = await Promise.all([
    db.looks.toArray(),
    db.pieces.toArray(),
    db.lookPieces.toArray(),
    db.settings.filter((st) => !isDeviceKey(st.key)).toArray(),
    db.photos.toArray(),
    db.collections.toArray(),
    db.lookCollections.toArray(),
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
    collections,
    lookCollections,
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

  const collections = data.collections ?? []
  const lookCollections = data.lookCollections ?? []
  if (!Array.isArray(collections) || !Array.isArray(lookCollections)) throw new Error('Backup is damaged (collections).')

  const photos = data.photos.map((p) => {
    const bytes = entries[p.path]
    if (!bytes) throw new Error(`Backup is damaged (photo ${p.path} missing).`)
    return { id: p.id, createdAt: p.createdAt, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: p.type }) }
  })

  const settings = data.settings.filter((st) => !isDeviceKey(st.key))
  const tables = [db.looks, db.pieces, db.lookPieces, db.photos, db.settings, db.collections, db.lookCollections]
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all(tables.filter((t) => t !== db.settings).map((t) => t.clear()))
      await db.settings.where('key').noneOf(DEVICE_KEYS).delete()
      await db.settings.bulkPut(settings)
      await db.looks.bulkPut(data.looks)
      await db.pieces.bulkPut(data.pieces)
      await db.collections.bulkPut(collections)
    } else {
      await db.looks.bulkPut(await newerOnly(db.looks, data.looks))
      await db.pieces.bulkPut(await newerOnly(db.pieces, data.pieces))
      await db.collections.bulkPut(await newerOnly(db.collections, collections))
      for (const s of settings) {
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
    await db.lookCollections.bulkPut(lookCollections)
  })

  return { looks: data.looks.length, pieces: data.pieces.length, collections: collections.length, photos: photos.length }
}

async function newerOnly<T extends { id: string; updatedAt: number }>(
  table: { bulkGet(keys: string[]): Promise<(T | undefined)[]> },
  incoming: T[],
): Promise<T[]> {
  const existing = await table.bulkGet(incoming.map((r) => r.id))
  return incoming.filter((r, i) => !existing[i] || existing[i]!.updatedAt <= r.updatedAt)
}

// ---------- backup reminder ----------

const DAY = 24 * 60 * 60 * 1000
export const REMIND_AFTER_DAYS = 7
export const REMIND_AFTER_ADDED = 10

export interface BackupStatus {
  /** Last export on this phone; undefined = never. */
  lastAt?: number
  /** Whole days since the last export; undefined = never. */
  daysSince?: number
  /** Looks + pieces created since the last export (or ever, if never exported). */
  added: number
  due: boolean
}

/**
 * Due when there is data and either the last export (or, if never exported, the oldest look or piece)
 * is more than 7 days old, or 10+ looks and pieces were added since. "Later" hides it for a day.
 */
export function isBackupDue(o: { now: number; lastAt?: number; oldestAt?: number; added: number; snoozedUntil?: number }): boolean {
  if (o.snoozedUntil && o.now < o.snoozedUntil) return false
  const since = o.lastAt ?? o.oldestAt
  if (since === undefined) return false // no data yet
  return o.now - since > REMIND_AFTER_DAYS * DAY || o.added >= REMIND_AFTER_ADDED
}

export async function backupStatus(now = Date.now()): Promise<BackupStatus> {
  const get = async (key: string) => (await db.settings.get(key))?.value as number | undefined
  const [lastAt, snoozedUntil] = await Promise.all([get(BACKUP_SETTING.lastAt), get(BACKUP_SETTING.snoozedUntil)])
  const after = lastAt ?? 0
  const [looks, oldestLook, pieces] = await Promise.all([
    db.looks.where('createdAt').above(after).count(),
    db.looks.orderBy('createdAt').first(),
    db.pieces.toArray(), // few rows; pieces have no createdAt index
  ])
  const added = looks + pieces.filter((p) => p.createdAt > after).length
  const oldest = Math.min(oldestLook?.createdAt ?? Infinity, ...pieces.map((p) => p.createdAt))
  const oldestAt = Number.isFinite(oldest) ? oldest : undefined
  const daysSince = lastAt === undefined ? undefined : Math.floor((now - lastAt) / DAY)
  return { lastAt, daysSince, added, due: isBackupDue({ now, lastAt, oldestAt, added, snoozedUntil }) }
}

export const markBackedUp = (at = Date.now()) => db.settings.put({ key: BACKUP_SETTING.lastAt, value: at })
export const snoozeBackupReminder = (now = Date.now()) => db.settings.put({ key: BACKUP_SETTING.snoozedUntil, value: now + DAY })
