import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CropEditor } from '../components/CropEditor'
import { LookCollections } from '../components/LookCollections'
import { Photo } from '../components/Photo'
import { PiecePicker } from '../components/PiecePicker'
import { StatusToggle } from '../components/StatusToggle'
import { useLook, usePhotoBlob } from '../data/hooks'
import { deleteLook, replaceLookPhoto, unlinkPiece, updateLook, updatePiece } from '../data/repo'

export function LookDetail() {
  const { id = '' } = useParams()
  const data = useLook(id)
  const navigate = useNavigate()
  const [cropping, setCropping] = useState(false)
  const photoBlob = usePhotoBlob(data?.look.photoId)

  if (data === undefined) return <main className="page" />
  if (data === null) return <main className="page"><p className="empty">Look not found. <Link to="/">Back to looks</Link></p></main>

  const { look, pieces, complete } = data

  return (
    <main className="page">
      <header className="page-head">
        <Link to="/" className="back">← Looks</Link>
        {complete && <span className="badge owned">Complete</span>}
      </header>

      <div className="hero-wrap">
        <Photo photoId={look.photoId} alt={look.title || 'Look'} className="hero" />
        {photoBlob && <button type="button" className="btn small" onClick={() => setCropping(true)}>Crop</button>}
      </div>
      {cropping && photoBlob && (
        <CropEditor
          image={photoBlob}
          requireChange
          onCancel={() => setCropping(false)}
          onDone={async (b) => { await replaceLookPhoto(look.id, b); setCropping(false) }}
        />
      )}

      <div className="stack" key={look.id}>
        <label className="field">
          <span>Name (optional)</span>
          <input defaultValue={look.title} placeholder="Office Monday" onBlur={(e) => e.target.value !== look.title && updateLook(look.id, { title: e.target.value })} />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea defaultValue={look.notes} rows={2} onBlur={(e) => e.target.value !== look.notes && updateLook(look.id, { notes: e.target.value })} />
        </label>
      </div>

      <h2>Pieces ({pieces.length})</h2>
      {pieces.length === 0 && <p className="muted">Tag each piece in this look. Pieces are shared across looks.</p>}
      <ul className="list">
        {pieces.map((p) => (
          <li key={p.id} className="piece-row">
            {p.photoId && <Photo photoId={p.photoId} alt="" className="piece-thumb" />}
            <Link to={`/pieces/${p.id}`} className="piece-info">
              <span>{p.name}</span>
              <small className="muted">{[p.brand, p.category, ...p.styles].filter(Boolean).join(' · ')}</small>
            </Link>
            <StatusToggle value={p.status} onChange={(s) => updatePiece(p.id, { status: s })} />
            <button type="button" className="icon-btn" aria-label={`Remove ${p.name} from look`} onClick={() => unlinkPiece(look.id, p.id)}>×</button>
          </li>
        ))}
      </ul>

      <PiecePicker lookId={look.id} linkedIds={pieces.map((p) => p.id)} />

      <h2>Collections</h2>
      <LookCollections lookId={look.id} />

      <button
        type="button"
        className="btn danger"
        onClick={async () => {
          if (!confirm('Delete this look and its photo? Pieces stay in your list. This cannot be undone.')) return
          await deleteLook(look.id)
          navigate('/')
        }}
      >
        Delete look
      </button>
    </main>
  )
}
