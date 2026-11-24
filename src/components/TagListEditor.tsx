import { useState } from 'react'
import { setTagList } from '../data/repo'
import type { TagLists } from '../data/types'

export function TagListEditor({ kind, values }: { kind: keyof TagLists; values: string[] }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    void setTagList(kind, [...values, draft])
    setDraft('')
  }
  return (
    <div className="stack">
      <div className="chips">
        {values.map((v) => (
          <span key={v} className="chip">
            {v}
            <button type="button" className="chip-x" aria-label={`Remove ${v}`} onClick={() => setTagList(kind, values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={kind === 'categories' ? 'New category' : 'New style'} aria-label={kind === 'categories' ? 'New category' : 'New style'} />
        <button type="submit" className="btn">Add</button>
      </form>
    </div>
  )
}
