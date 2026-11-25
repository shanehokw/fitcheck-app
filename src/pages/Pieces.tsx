import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PieceForm } from '../components/PieceForm'
import { Photo } from '../components/Photo'
import { DragHandle, SortableArea } from '../components/Sortable'
import {
  EMPTY_FILTER, extraFilterCount, filterFromParams, filterOptions, filterToParams, matchesFilter, type PieceFilter,
} from '../lib/pieceFilter'
import { moveWithin, useOptimisticOrder, useSortableRow } from '../lib/sortable'
import { usePiece, usePieces } from '../data/hooks'
import { createPiece, deletePiece, reorderPieces, updatePiece } from '../data/repo'
import type { Piece } from '../data/types'

export function Pieces() {
  const pieces = usePieces()
  const [params, setParams] = useSearchParams()
  const filter = filterFromParams(params)
  const extra = extraFilterCount(filter)
  const [panelOpen, setPanelOpen] = useState(extra > 0)
  const { ordered, show } = useOptimisticOrder(pieces, (p) => p.id)
  const all = ordered ?? []
  const shown = all.filter((p) => matchesFilter(p, filter))
  const options = filterOptions(all)
  const active = extra > 0 || filter.q.trim() !== '' || filter.status !== 'all'

  const set = (patch: Partial<PieceFilter>) => setParams(filterToParams({ ...filter, ...patch }), { replace: true })
  const toggleStyle = (st: string) =>
    set({ styles: filter.styles.includes(st) ? filter.styles.filter((x) => x !== st) : [...filter.styles, st] })

  function onMove(activeId: string, overId: string) {
    const ids = moveWithin(all.map((p) => p.id), shown.map((p) => p.id), activeId, overId)
    show(ids)
    void reorderPieces(ids)
  }

  return (
    <main className="page">
      <header className="page-head">
        <h1>Pieces</h1>
        <Link to="/pieces/new" className="btn primary">+ Add piece</Link>
      </header>

      {all.length > 0 && (
        <div className="stack filters">
          <input type="search" value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search name, brand, style…" aria-label="Search pieces" />
          <div className="row">
            <div className="segmented" role="tablist" aria-label="Filter by status">
              {(['all', 'owned', 'wanted'] as const).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter.status === f} className={filter.status === f ? 'on' : ''} onClick={() => set({ status: f })}>
                  {f === 'all' ? 'All' : f === 'owned' ? 'Owned' : 'Wanted'}
                </button>
              ))}
            </div>
            <button type="button" className={`btn small ${extra ? 'primary' : ''}`} aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
              Filters{extra ? ` (${extra})` : ''}
            </button>
          </div>

          {panelOpen && (
            <div className="card stack">
              <div className="row">
                <label className="field grow">
                  <span>Category</span>
                  <select value={filter.category} onChange={(e) => set({ category: e.target.value })}>
                    <option value="">Any</option>
                    {options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="field grow">
                  <span>Brand</span>
                  <select value={filter.brand} onChange={(e) => set({ brand: e.target.value })} disabled={options.brands.length === 0}>
                    <option value="">{options.brands.length ? 'Any' : 'No brands yet'}</option>
                    {options.brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>
              {options.styles.length > 0 && (
                <div className="field">
                  <span>Styles (has all selected)</span>
                  <div className="chips">
                    {options.styles.map((st) => (
                      <button type="button" key={st} className={`chip ${filter.styles.includes(st) ? 'on' : ''}`} aria-pressed={filter.styles.includes(st)} onClick={() => toggleStyle(st)}>
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {active && (
            <div className="row filter-summary">
              <small className="muted">Showing {shown.length} of {all.length}</small>
              <button type="button" className="link-btn" onClick={() => setParams(filterToParams(EMPTY_FILTER), { replace: true })}>Clear filters</button>
            </div>
          )}
        </div>
      )}

      {pieces && all.length === 0 && <p className="empty">No pieces yet. Add them from a look, or here.</p>}
      {all.length > 0 && shown.length === 0 && <p className="empty">No pieces match these filters.</p>}
      <SortableArea ids={shown.map((p) => p.id)} layout="list" onMove={onMove}>
        <ul className="list">
          {shown.map((p) => <PieceRow key={p.id} piece={p} canDrag={shown.length > 1} />)}
        </ul>
      </SortableArea>
    </main>
  )
}

function PieceRow({ piece: p, canDrag }: { piece: Piece & { lookCount: number }; canDrag: boolean }) {
  const row = useSortableRow(p.id)
  const { search } = useLocation()
  return (
    <li ref={row.ref} style={row.style} className={`sortable-row ${row.isDragging ? 'dragging' : ''}`}>
      <Link to={`/pieces/${p.id}`} state={{ back: `/pieces${search}` }} className="list-btn">
        <span className="name-with-thumb">{p.photoId && <Photo photoId={p.photoId} alt="" className="piece-thumb" />}{p.name}</span>
        <small className="muted">
          {p.brand ? `${p.brand} · ` : ''}{p.category}{p.styles.length ? ` · ${p.styles.join(', ')}` : ''} · {p.lookCount} look{p.lookCount === 1 ? '' : 's'}
        </small>
        <span className={`badge ${p.status}`}>{p.status}</span>
      </Link>
      {canDrag && <DragHandle label={p.name} handle={row.handle} />}
    </li>
  )
}

export function NewPiece() {
  const navigate = useNavigate()
  return (
    <main className="page">
      <header className="page-head"><Link to="/pieces" className="back">← Pieces</Link></header>
      <h1>New piece</h1>
      <PieceForm submitLabel="Save" onCancel={() => navigate('/pieces')} onSubmit={async (p, photo) => { await createPiece(p, photo ?? undefined); navigate('/pieces') }} />
    </main>
  )
}

export function PieceDetail() {
  const { id = '' } = useParams()
  const data = usePiece(id)
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  // Back to the list with the filters it had.
  const back = (useLocation().state as { back?: string } | null)?.back ?? '/pieces'

  if (data === undefined) return <main className="page" />
  if (data === null) return <main className="page"><p className="empty">Piece not found. <Link to="/pieces">Back</Link></p></main>
  const { piece, looks } = data

  return (
    <main className="page">
      <header className="page-head">
        <Link to={back} className="back">← Pieces</Link>
        <button
          type="button"
          className="icon-btn danger-icon"
          aria-label="Delete piece"
          title="Delete piece"
          onClick={async () => {
            if (!confirm(`Delete “${piece.name}”? It will be removed from ${looks.length} look(s). This cannot be undone.`)) return
            await deletePiece(piece.id)
            navigate(back)
          }}
        >
          <TrashIcon />
        </button>
      </header>
      <h1>{piece.name}</h1>
      <PieceForm
        key={piece.id}
        initial={piece}
        initialPhotoId={piece.photoId}
        autoFocus={false}
        submitLabel={saved ? 'Saved ✓' : 'Save'}
        onSubmit={async (p, photo) => { await updatePiece(piece.id, p, photo); setSaved(true); setTimeout(() => setSaved(false), 1500) }}
      />
      <h2>In {looks.length} look{looks.length === 1 ? '' : 's'}</h2>
      <ul className="grid small">
        {looks.map((l) => (
          <li key={l.id}>
            <Link to={`/look/${l.id}`} className="look-card">
              <Photo photoId={l.photoId} alt="Look" className="thumb" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
