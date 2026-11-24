import Dexie, { type EntityTable } from 'dexie'
import type { Collection, Look, LookCollection, LookPiece, Photo, Piece, Setting } from '../types'

// Only files in src/data/ may import this. UI code uses the repository functions.
export class FitcheckDB extends Dexie {
  looks!: EntityTable<Look, 'id'>
  pieces!: EntityTable<Piece, 'id'>
  lookPieces!: Dexie.Table<LookPiece, [string, string]>
  photos!: EntityTable<Photo, 'id'>
  settings!: EntityTable<Setting, 'key'>
  collections!: EntityTable<Collection, 'id'>
  lookCollections!: Dexie.Table<LookCollection, [string, string]>

  constructor(name = 'fitcheck') {
    super(name)
    this.version(1).stores({
      looks: 'id, createdAt, updatedAt',
      pieces: 'id, name, category, status, *styles, updatedAt',
      lookPieces: '[lookId+pieceId], lookId, pieceId',
      photos: 'id',
      settings: 'key',
    })
    // v2 adds collections. New tables only: existing data is not changed.
    this.version(2).stores({
      collections: 'id, name, createdAt',
      lookCollections: '[lookId+collectionId], lookId, collectionId',
    })
  }
}

export const db = new FitcheckDB()
