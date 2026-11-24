import { useState } from 'react'
import { useTagLists } from '../data/hooks'
import { setTagList } from '../data/repo'
import type { PieceInput } from '../data/types'
import { StatusToggle } from './StatusToggle'

interface Props {
  initial?: Partial<PieceInput>
  submitLabel: string
  onSubmit: (p: PieceInput) => void | Promise<void>
  onCancel?: () => void
}

export function PieceForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const tags = useTagLists()
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [styles, setStyles] = useState<string[]>(initial?.styles ?? [])
  const [status, setStatus] = useState(initial?.status ?? 'owned')
  const [productUrl, setProductUrl] = useState(initial?.productUrl ?? '')
  const [newStyle, setNewStyle] = useState('')

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
        void onSubmit({ name, category, styles, status, productUrl })
      }}
    >
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Black pencil skirt" required autoFocus={!initial?.name} />
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
      <label className="field">
        <span>Product link (optional)</span>
        <input type="url" inputMode="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://…" />
      </label>
      <div className="row">
        <button type="submit" className="btn primary" disabled={!name.trim() || !category}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
