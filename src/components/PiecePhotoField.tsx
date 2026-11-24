import { useEffect, useState } from 'react'
import { downloadProductPhoto, findProductPhotos, isHttpUrl } from '../lib/productPhotos'
import { CoverPicker } from './CoverPicker'
import { CropEditor } from './CropEditor'
import { Photo } from './Photo'

interface Props {
  productUrl: string
  /** Saved photo of the piece, if any. */
  savedPhotoId?: string
  /** undefined = keep saved photo, null = removed, Blob = new photo. */
  value: Blob | null | undefined
  onChange: (v: Blob | null) => void
}

export function PiecePhotoField({ productUrl, savedPhotoId, value, onChange }: Props) {
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState<string>()
  const [candidates, setCandidates] = useState<string[]>()
  const [toCrop, setToCrop] = useState<Blob>()
  const newUrl = useObjectUrl(value ?? undefined)
  const showSaved = value === undefined && savedPhotoId
  const hasPhoto = !!value || !!showSaved

  async function find() {
    setFinding(true)
    setError(undefined)
    try {
      const images = await findProductPhotos(productUrl.trim())
      if (images.length === 0) setError('No photos found at this link. Upload your own instead.')
      else setCandidates(images)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setFinding(false)
    }
  }

  return (
    <div className="field">
      <span>Photo (optional)</span>
      {newUrl && <img src={newUrl} alt="Piece" className="piece-photo" />}
      {showSaved && <Photo photoId={savedPhotoId} alt="Piece" className="piece-photo" />}
      <div className="row">
        <button type="button" className="btn" disabled={!isHttpUrl(productUrl) || finding} onClick={find} title={isHttpUrl(productUrl) ? undefined : 'Add a product link first'}>
          {finding ? 'Finding…' : 'Photos from link'}
        </button>
        <CoverPicker label="Upload photo" onPicked={onChange} />
        {hasPhoto && <button type="button" className="btn" onClick={() => onChange(null)}>Remove</button>}
      </div>
      {!isHttpUrl(productUrl) && <small className="muted">Paste a product link above to pick from the store's photos.</small>}
      {error && <p className="error">{error}</p>}

      {candidates && (
        <CandidateSheet
          urls={candidates}
          onClose={() => setCandidates(undefined)}
          onPick={(blob) => {
            setCandidates(undefined)
            setToCrop(blob)
          }}
        />
      )}
      {toCrop && (
        <CropEditor
          image={toCrop}
          onCancel={() => setToCrop(undefined)}
          onDone={(b) => {
            onChange(b)
            setToCrop(undefined)
          }}
        />
      )}
    </div>
  )
}

function CandidateSheet({ urls, onPick, onClose }: { urls: string[]; onPick: (b: Blob) => void; onClose: () => void }) {
  const [blobs, setBlobs] = useState<Record<string, Blob | 'failed'>>({})

  useEffect(() => {
    let alive = true
    for (const u of urls) {
      downloadProductPhoto(u)
        .then((b) => alive && setBlobs((cur) => ({ ...cur, [u]: b })))
        .catch(() => alive && setBlobs((cur) => ({ ...cur, [u]: 'failed' })))
    }
    return () => {
      alive = false
    }
  }, [urls])

  const loaded = urls.filter((u) => blobs[u] instanceof Blob)
  const pending = urls.filter((u) => !blobs[u]).length
  const allFailed = pending === 0 && loaded.length === 0

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label="Choose a photo">
      <div className="sheet">
        <div className="page-head">
          <h2>Choose a photo</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {pending > 0 && <p className="muted">Loading {pending} photo{pending === 1 ? '' : 's'}…</p>}
        {allFailed && <p className="error">The store blocked the photos. Upload your own instead.</p>}
        <ul className="grid small">
          {loaded.map((u) => (
            <li key={u}>
              <BlobThumb blob={blobs[u] as Blob} onClick={() => onPick(blobs[u] as Blob)} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function BlobThumb({ blob, onClick }: { blob: Blob; onClick: () => void }) {
  const url = useObjectUrl(blob)
  return (
    <button type="button" className="pick" onClick={onClick} aria-label="Use this photo">
      {url && <img src={url} alt="" className="thumb contain" />}
    </button>
  )
}

function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
