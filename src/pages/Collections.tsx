import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CoverPicker } from '../components/CoverPicker'
import { LookCard } from '../components/LookCard'
import { Photo } from '../components/Photo'
import { DragHandle, SortableArea } from '../components/Sortable'
import { moveWithin, useOptimisticOrder, useSortableRow } from '../lib/sortable'
import { useCollection, useCollections, useLookSummaries } from '../data/hooks'
import {
  addLookToCollection, createCollection, deleteCollection, removeLookFromCollection, renameCollection, reorderCollections,
  setCollectionCover,
} from '../data/repo'
import type { CollectionSummary } from '../data/types'

export function Collections() {
  const collections = useCollections()
  const { ordered, show } = useOptimisticOrder(collections, (c) => c.collection.id)
  const ids = (ordered ?? []).map((c) => c.collection.id)

  function onMove(activeId: string, overId: string) {
    const next = moveWithin(ids, ids, activeId, overId)
    show(next)
    void reorderCollections(next)
  }

  return (
    <main className="page">
      <header className="page-head">
        <h1>Collections</h1>
        <Link to="/collections/new" className="btn primary">+ New</Link>
      </header>
      {collections && collections.length === 0 && (
        <p className="empty">No collections yet. Group looks by trip, season, or occasion.</p>
      )}
      <SortableArea ids={ids} layout="grid" onMove={onMove}>
        <ul className="grid">
          {ordered?.map((c) => <CollectionCard key={c.collection.id} summary={c} canDrag={ids.length > 1} />)}
        </ul>
      </SortableArea>
    </main>
  )
}

function CollectionCard({ summary: { collection, lookCount, previewPhotoId }, canDrag }: { summary: CollectionSummary; canDrag: boolean }) {
  const row = useSortableRow(collection.id)
  return (
    <li ref={row.ref} style={row.style} className={`card-wrap ${row.isDragging ? 'dragging' : ''}`}>
      <Link to={`/collections/${collection.id}`} className="look-card">
        <Photo photoId={previewPhotoId} alt="" className="thumb" />
        <div className="look-meta">
          <span className="look-title">{collection.name}</span>
          <span className="badge">{lookCount}</span>
        </div>
      </Link>
      {canDrag && <DragHandle label={collection.name} className="card-handle" handle={row.handle} />}
    </li>
  )
}

export function NewCollection() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [cover, setCover] = useState<Blob>()
  const coverUrl = useObjectUrl(cover)

  return (
    <main className="page">
      <header className="page-head"><Link to="/collections" className="back">← Collections</Link></header>
      <h1>New collection</h1>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const id = await createCollection({ name, cover })
          navigate(`/collections/${id}`, { replace: true })
        }}
      >
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tokyo trip" required autoFocus />
        </label>
        <div className="field">
          <span>Cover photo (optional)</span>
          {coverUrl && <img src={coverUrl} alt="Cover" className="cover-preview" />}
          <div className="row">
            <CoverPicker label={cover ? 'Change cover' : 'Add cover'} onPicked={setCover} />
            {cover && <button type="button" className="btn" onClick={() => setCover(undefined)}>Remove</button>}
          </div>
        </div>
        <button type="submit" className="btn primary" disabled={!name.trim()}>Create</button>
      </form>
    </main>
  )
}

export function CollectionDetail() {
  const { id = '' } = useParams()
  const data = useCollection(id)
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  if (data === undefined) return <main className="page" />
  if (data === null) return <main className="page"><p className="empty">Collection not found. <Link to="/collections">Back</Link></p></main>
  const { collection, looks } = data

  return (
    <main className="page">
      <header className="page-head"><Link to="/collections" className="back">← Collections</Link></header>

      {collection.coverPhotoId && <Photo photoId={collection.coverPhotoId} alt="Cover" className="cover-preview" />}
      <div className="row">
        <CoverPicker label={collection.coverPhotoId ? 'Change cover' : 'Add cover'} onPicked={(b) => setCollectionCover(collection.id, b)} />
        {collection.coverPhotoId && (
          <button type="button" className="btn" onClick={() => setCollectionCover(collection.id, null)}>Remove cover</button>
        )}
      </div>

      <label className="field" key={collection.id}>
        <span>Name</span>
        <input
          defaultValue={collection.name}
          required
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (!v) e.target.value = collection.name
            else if (v !== collection.name) void renameCollection(collection.id, v)
          }}
        />
      </label>

      <div className="page-head">
        <h2>Looks ({looks.length})</h2>
        <button type="button" className="btn small" onClick={() => setAdding(true)}>+ Add looks</button>
      </div>
      {looks.length === 0 && <p className="muted">No looks in this collection yet.</p>}
      <ul className="grid">
        {looks.map((s) => (
          <li key={s.look.id} className="card-wrap">
            <LookCard summary={s} />
            <button type="button" className="remove-x" aria-label="Remove from collection" onClick={() => removeLookFromCollection(s.look.id, collection.id)}>×</button>
          </li>
        ))}
      </ul>

      {adding && <AddLooksSheet collectionId={collection.id} existing={looks.map((l) => l.look.id)} onClose={() => setAdding(false)} />}

      <button
        type="button"
        className="btn danger"
        onClick={async () => {
          if (!confirm(`Delete the collection “${collection.name}”? Its looks stay. This cannot be undone.`)) return
          await deleteCollection(collection.id)
          navigate('/collections')
        }}
      >
        Delete collection
      </button>
    </main>
  )
}

function AddLooksSheet({ collectionId, existing, onClose }: { collectionId: string; existing: string[]; onClose: () => void }) {
  const all = useLookSummaries()
  const [picked, setPicked] = useState<string[]>([])
  const candidates = (all ?? []).filter((s) => !existing.includes(s.look.id))
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label="Add looks">
      <div className="sheet">
        <div className="page-head">
          <h2>Add looks</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {all && candidates.length === 0 && <p className="muted">All your looks are already in this collection.</p>}
        <ul className="grid small">
          {candidates.map((s) => (
            <li key={s.look.id}>
              <button
                type="button"
                className={`pick ${picked.includes(s.look.id) ? 'on' : ''}`}
                aria-pressed={picked.includes(s.look.id)}
                aria-label="Look"
                onClick={() => toggle(s.look.id)}
              >
                <Photo photoId={s.look.photoId} alt="" className="thumb" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn primary"
          disabled={picked.length === 0}
          onClick={async () => {
            await Promise.all(picked.map((lookId) => addLookToCollection(lookId, collectionId)))
            onClose()
          }}
        >
          Add {picked.length || ''} look{picked.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
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
