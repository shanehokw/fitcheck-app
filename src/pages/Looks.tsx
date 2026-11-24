import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Photo } from '../components/Photo'
import { useLookSummaries } from '../data/hooks'
import { createLook } from '../data/repo'
import { compressImage } from '../lib/image'

type Filter = 'all' | 'complete' | 'incomplete'

export function Looks() {
  const looks = useLookSummaries()
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  async function onFile(file?: File) {
    if (!file) return
    setBusy(true)
    setError(undefined)
    try {
      const id = await createLook({ photo: await compressImage(file) })
      navigate(`/look/${id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const shown = (looks ?? []).filter((l) => filter === 'all' || (filter === 'complete') === l.complete)

  return (
    <main className="page">
      <header className="page-head">
        <h1>Looks</h1>
        <label className={`btn primary ${busy ? 'disabled' : ''}`}>
          {busy ? 'Saving…' : '+ Add look'}
          <input ref={input} type="file" accept="image/*" hidden disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="segmented wide" role="tablist" aria-label="Filter looks">
        {(['all', 'complete', 'incomplete'] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'complete' ? 'Complete' : 'Need pieces'}
          </button>
        ))}
      </div>

      {looks && shown.length === 0 && (
        <p className="empty">
          {looks.length === 0 ? 'No looks yet. Add a photo of an outfit to start.' : filter === 'complete' ? 'No complete looks yet. A look is complete when you own every piece.' : 'Nothing here.'}
        </p>
      )}

      <ul className="grid">
        {shown.map(({ look, pieces, complete }) => {
          const wanted = pieces.filter((p) => p.status === 'wanted').length
          return (
            <li key={look.id}>
              <Link to={`/look/${look.id}`} className="look-card">
                <Photo photoId={look.photoId} alt={look.title || 'Look'} className="thumb" />
                <div className="look-meta">
                  <span className="look-title">{look.title || 'Untitled'}</span>
                  {complete ? <span className="badge owned">Complete</span> : pieces.length === 0 ? <span className="badge">Untagged</span> : <span className="badge wanted">{wanted} wanted</span>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
