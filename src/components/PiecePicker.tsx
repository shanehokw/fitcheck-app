import { useState } from 'react'
import { usePieces } from '../data/hooks'
import { createPiece, linkPiece } from '../data/repo'
import { PieceForm } from './PieceForm'

export function PiecePicker({ lookId, linkedIds }: { lookId: string; linkedIds: string[] }) {
  const pieces = usePieces()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const q = query.trim().toLowerCase()
  const matches = (pieces ?? [])
    .filter((p) => !linkedIds.includes(p.id))
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.includes(q) || p.styles.some((s) => s.includes(q)))
    .slice(0, 8)

  if (creating) {
    return (
      <div className="card">
        <h3>New piece</h3>
        <PieceForm
          initial={{ name: query }}
          submitLabel="Add to look"
          onCancel={() => setCreating(false)}
          onSubmit={async (p) => {
            const id = await createPiece(p)
            await linkPiece(lookId, id)
            setCreating(false)
            setQuery('')
          }}
        />
      </div>
    )
  }

  return (
    <div className="card stack">
      <h3>Add a piece</h3>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your pieces" aria-label="Search your pieces" />
      {matches.length > 0 && (
        <ul className="list">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" className="list-btn" onClick={() => linkPiece(lookId, p.id)}>
                <span>{p.name}</span>
                <small className="muted">{p.category} · {p.status}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn" onClick={() => setCreating(true)}>
        + New piece{query.trim() ? ` “${query.trim()}”` : ''}
      </button>
    </div>
  )
}
