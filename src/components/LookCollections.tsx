import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollections, useLookCollectionIds } from '../data/hooks'
import { addLookToCollection, createCollection, removeLookFromCollection } from '../data/repo'

/** Toggle chips for each collection, plus a quick "new collection" field. */
export function LookCollections({ lookId }: { lookId: string }) {
  const collections = useCollections()
  const inIds = useLookCollectionIds(lookId) ?? []
  const [name, setName] = useState('')

  return (
    <div className="stack">
      {collections && collections.length > 0 && (
        <div className="chips">
          {collections.map(({ collection: c }) => {
            const on = inIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => (on ? removeLookFromCollection(lookId, c.id) : addLookToCollection(lookId, c.id))}
              >
                {on ? '✓ ' : ''}{c.name}
              </button>
            )
          })}
        </div>
      )}
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const id = await createCollection({ name })
          await addLookToCollection(lookId, id)
          setName('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection name" aria-label="New collection name" />
        <button type="submit" className="btn" disabled={!name.trim()}>Create + add</button>
      </form>
      {collections && collections.length > 0 && <Link to="/collections" className="muted small-link">Manage collections</Link>}
    </div>
  )
}
