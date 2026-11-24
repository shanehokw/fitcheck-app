import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PieceForm } from '../components/PieceForm'
import { Photo } from '../components/Photo'
import { usePiece, usePieces } from '../data/hooks'
import { createPiece, deletePiece, updatePiece } from '../data/repo'
import type { Status } from '../data/types'

export function Pieces() {
  const pieces = usePieces()
  const [filter, setFilter] = useState<'all' | Status>('all')
  const shown = (pieces ?? []).filter((p) => filter === 'all' || p.status === filter)

  return (
    <main className="page">
      <header className="page-head">
        <h1>Pieces</h1>
        <Link to="/pieces/new" className="btn primary">+ Add piece</Link>
      </header>
      <div className="segmented wide" role="tablist" aria-label="Filter pieces">
        {(['all', 'owned', 'wanted'] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'owned' ? 'Owned' : 'Wanted'}
          </button>
        ))}
      </div>
      {pieces && shown.length === 0 && <p className="empty">No pieces yet. Add them from a look, or here.</p>}
      <ul className="list">
        {shown.map((p) => (
          <li key={p.id}>
            <Link to={`/pieces/${p.id}`} className="list-btn">
              <span>{p.name}</span>
              <small className="muted">
                {p.category}{p.styles.length ? ` · ${p.styles.join(', ')}` : ''} · {p.lookCount} look{p.lookCount === 1 ? '' : 's'}
              </small>
              <span className={`badge ${p.status}`}>{p.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

export function NewPiece() {
  const navigate = useNavigate()
  return (
    <main className="page">
      <header className="page-head"><Link to="/pieces" className="back">← Pieces</Link></header>
      <h1>New piece</h1>
      <PieceForm submitLabel="Save" onCancel={() => navigate('/pieces')} onSubmit={async (p) => { await createPiece(p); navigate('/pieces') }} />
    </main>
  )
}

export function PieceDetail() {
  const { id = '' } = useParams()
  const data = usePiece(id)
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  if (data === undefined) return <main className="page" />
  if (data === null) return <main className="page"><p className="empty">Piece not found. <Link to="/pieces">Back</Link></p></main>
  const { piece, looks } = data

  return (
    <main className="page">
      <header className="page-head"><Link to="/pieces" className="back">← Pieces</Link></header>
      <h1>{piece.name}</h1>
      <PieceForm
        key={piece.id}
        initial={piece}
        submitLabel={saved ? 'Saved ✓' : 'Save'}
        onSubmit={async (p) => { await updatePiece(piece.id, p); setSaved(true); setTimeout(() => setSaved(false), 1500) }}
      />
      <h2>In {looks.length} look{looks.length === 1 ? '' : 's'}</h2>
      <ul className="grid small">
        {looks.map((l) => (
          <li key={l.id}>
            <Link to={`/look/${l.id}`} className="look-card">
              <Photo photoId={l.photoId} alt={l.title || 'Look'} className="thumb" />
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn danger"
        onClick={async () => {
          if (!confirm(`Delete “${piece.name}”? It will be removed from ${looks.length} look(s). This cannot be undone.`)) return
          await deletePiece(piece.id)
          navigate('/pieces')
        }}
      >
        Delete piece
      </button>
    </main>
  )
}
