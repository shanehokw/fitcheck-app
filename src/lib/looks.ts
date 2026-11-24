import type { Piece } from '../data/types'

/** A look is complete when it has at least one piece and every piece is owned. */
export function isComplete(pieces: Pick<Piece, 'status'>[]): boolean {
  return pieces.length > 0 && pieces.every((p) => p.status === 'owned')
}
