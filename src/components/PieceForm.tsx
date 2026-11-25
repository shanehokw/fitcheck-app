import { useEffect, useRef, useState } from 'react'
import { useTagLists } from '../data/hooks'
import { setTagList } from '../data/repo'
import type { PieceInput } from '../data/types'
import { findProduct, isHttpUrl } from '../lib/productPhotos'
import { PiecePhotoField } from './PiecePhotoField'
import { StatusToggle } from './StatusToggle'

interface Props {
  initial?: Partial<PieceInput>
  /** The piece's saved photo, when editing. */
  initialPhotoId?: string
  submitLabel: string
  /** photo: Blob = new photo, null = removed, undefined = unchanged. */
  onSubmit: (p: PieceInput, photo: Blob | null | undefined) => void | Promise<void>
  onCancel?: () => void
}

export function PieceForm({ initial, initialPhotoId, submitLabel, onSubmit, onCancel }: Props) {
  const tags = useTagLists()
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [styles, setStyles] = useState<string[]>(initial?.styles ?? [])
  const [status, setStatus] = useState(initial?.status ?? 'owned')
  const [productUrl, setProductUrl] = useState(initial?.productUrl ?? '')
  const [newStyle, setNewStyle] = useState('')
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined)
  const [linkNote, setLinkNote] = useState<{ text: string; error?: boolean }>()
  const [lookedUp, setLookedUp] = useState(initial?.productUrl?.trim() ?? '')

  // Latest typed values, so a slow lookup never overwrites what the user typed meanwhile.
  const latest = useRef({ name, brand })
  useEffect(() => {
    latest.current = { name, brand }
  })

  // When a new link is entered, fill name and brand from the store page. Typed values are kept.
  async function fillFromLink(raw: string) {
    const url = raw.trim()
    if (!isHttpUrl(url) || url === lookedUp) return
    setLookedUp(url)
    setLinkNote({ text: 'Reading the link…' })
    try {
      const info = await findProduct(url)
      const filled: string[] = []
      if (info.name && !latest.current.name.trim()) {
        setName(info.name)
        filled.push('name')
      }
      if (info.brand && !latest.current.brand.trim()) {
        setBrand(info.brand)
        filled.push('brand')
      }
      setLinkNote(
        filled.length ? { text: `Filled ${filled.join(' and ')} from the link.` }
        : info.name || info.brand ? undefined
        : { text: 'No name or brand found at this link.' },
      )
    } catch (e) {
      setLinkNote({ text: (e as Error).message, error: true })
    }
  }

  const toggleStyle = (s: string) => setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  // Adds the style to the saved list (so it shows for every piece) and selects it here.
  async function addStyle() {
    const v = newStyle.trim().toLowerCase()
    if (!v) return
    if (!tags?.styles.includes(v)) await setTagList('styles', [...(tags?.styles ?? []), v])
    setStyles((cur) => (cur.includes(v) ? cur : [...cur, v]))
    setNewStyle('')
  }

  const allStyles = [...new Set([...(tags?.styles ?? []), ...styles])]
  const allCats = [...new Set([...(tags?.categories ?? []), ...(category ? [category] : [])])]

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || !category) return
        void onSubmit({ name, brand, category, styles, status, productUrl }, photo)
      }}
    >
      <label className="field">
        <span>Product link (optional)</span>
        <small className="muted">Paste a store link to fill in the name and brand, and to pick a store photo.</small>
        <input
          type="url"
          inputMode="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          onBlur={(e) => void fillFromLink(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            if (!productUrl.trim() && isHttpUrl(pasted)) void fillFromLink(pasted)
          }}
          placeholder="https://…"
        />
        {linkNote && <small className={linkNote.error ? 'error' : 'muted'}>{linkNote.text}</small>}
      </label>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Black pencil skirt" required autoFocus={!initial?.name} />
      </label>
      <label className="field">
        <span>Brand (optional)</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Uniqlo" autoComplete="off" />
      </label>
      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="" disabled>Pick one</option>
          {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="field">
        <span>Styles</span>
        <div className="chips">
          {allStyles.map((s) => (
            <button type="button" key={s} className={`chip ${styles.includes(s) ? 'on' : ''}`} aria-pressed={styles.includes(s)} onClick={() => toggleStyle(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="row">
          <input
            value={newStyle}
            onChange={(e) => setNewStyle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addStyle()
              }
            }}
            placeholder="Add your own style"
            aria-label="Add your own style"
          />
          <button type="button" className="btn" disabled={!newStyle.trim()} onClick={addStyle}>Add</button>
        </div>
      </div>
      <div className="field">
        <span>Status</span>
        <StatusToggle value={status} onChange={setStatus} />
      </div>
      <PiecePhotoField productUrl={productUrl} savedPhotoId={initialPhotoId} value={photo} onChange={setPhoto} />
      <div className="row">
        <button type="submit" className="btn primary" disabled={!name.trim() || !category}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
