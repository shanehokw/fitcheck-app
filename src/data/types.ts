export type Status = 'owned' | 'wanted'

export interface Look {
  id: string
  photoId: string
  title: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Piece {
  id: string
  name: string
  brand?: string
  category: string
  styles: string[]
  status: Status
  productUrl?: string
  savedPrice?: number
  lastCheckedPrice?: number
  photoId?: string
  /** Manual position in the Pieces list. Unset rows go last, by name. */
  sortOrder?: number
  createdAt: number
  updatedAt: number
}

export interface LookPiece {
  lookId: string
  pieceId: string
  createdAt: number
}

export interface Photo {
  id: string
  blob: Blob
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export interface TagLists {
  categories: string[]
  styles: string[]
}

export interface LookSummary {
  look: Look
  pieces: Piece[]
  complete: boolean
}

export type PieceInput = Pick<Piece, 'name' | 'category' | 'styles' | 'status'> &
  Partial<Pick<Piece, 'brand' | 'productUrl' | 'savedPrice'>>

export interface Collection {
  id: string
  name: string
  coverPhotoId?: string
  /** Manual position in the Collections list. Unset rows go last, by name. */
  sortOrder?: number
  createdAt: number
  updatedAt: number
}

export interface LookCollection {
  lookId: string
  collectionId: string
  createdAt: number
}

export interface CollectionSummary {
  collection: Collection
  lookCount: number
  /** Cover photo, or the newest look's photo when there is no cover. */
  previewPhotoId?: string
}
