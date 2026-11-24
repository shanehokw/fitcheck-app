import Dexie, { type EntityTable } from 'dexie'
import type { Look, LookPiece, Photo, Piece, Setting } from '../types'

// Only files in src/data/ may import this. UI code uses the repository functions.
export class FitcheckDB extends Dexie {
  looks!: EntityTable<Look, 'id'>
  pieces!: EntityTable<Piece, 'id'>
  lookPieces!: Dexie.Table<LookPiece, [string, string]>
  photos!: EntityTable<Photo, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'fitcheck') {
    super(name)
    this.version(1).stores({
      looks: 'id, createdAt, updatedAt',
      pieces: 'id, name, category, status, *styles, updatedAt',
      lookPieces: '[lookId+pieceId], lookId, pieceId',
      photos: 'id',
      settings: 'key',
    })
  }
}

export const db = new FitcheckDB()
