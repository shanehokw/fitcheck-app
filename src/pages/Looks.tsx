import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CropEditor } from '../components/CropEditor'
import { LookCard } from '../components/LookCard'
import { PasteButton } from '../components/PasteButton'
import { useLookSummaries } from '../data/hooks'
import { createLook } from '../data/repo'
import { imageFromPaste } from '../lib/clipboard'

type Filter = 'all' | 'complete' | 'incomplete'

export function Looks() {
  const looks = useLookSummaries()
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [toCrop, setToCrop] = useState<Blob>()
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  async function onFile(file?: File) {
    if (!file) return
    setError(undefined)
    setToCrop(file)
    if (input.current) input.current.value = ''
  }

  // Cmd/Ctrl+V anywhere on this page starts a new look from a copied photo.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (toCrop || busy) return
      const img = imageFromPaste(e)
      if (!img) return
      e.preventDefault()
      setError(undefined)
      setToCrop(img)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [toCrop, busy])

  async function saveLook(photo: Blob) {
    setBusy(true)
    const id = await createLook({ photo }).finally(() => setBusy(false))
    setToCrop(undefined)
    navigate(`/look/${id}`)
  }

  const shown = (looks ?? []).filter((l) => filter === 'all' || (filter === 'complete') === l.complete)

  return (
    <main className="page">
      {toCrop && <CropEditor image={toCrop} onDone={saveLook} onCancel={() => setToCrop(undefined)} />}
      <header className="page-head">
        <h1>Looks</h1>
        <div className="row">
          <PasteButton disabled={busy} onImage={(b) => { setError(undefined); setToCrop(b) }} onError={setError} />
          <label className={`btn primary ${busy ? 'disabled' : ''}`}>
            {busy ? 'Saving…' : '+ Add look'}
            <input ref={input} type="file" accept="image/*" hidden disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
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
        {shown.map((s) => (
          <li key={s.look.id}>
            <LookCard summary={s} />
          </li>
        ))}
      </ul>
    </main>
  )
}
