import { Link } from 'react-router-dom'
import type { LookSummary } from '../data/types'
import { Photo } from './Photo'

export function LookCard({ summary }: { summary: LookSummary }) {
  const { look, pieces, complete } = summary
  const wanted = pieces.filter((p) => p.status === 'wanted').length
  return (
    <Link to={`/look/${look.id}`} className="look-card">
      <Photo photoId={look.photoId} alt={look.title || 'Look'} className="thumb" />
      <div className="look-meta">
        {look.title && <span className="look-title">{look.title}</span>}
        {complete ? (
          <span className="badge owned">Complete</span>
        ) : pieces.length === 0 ? (
          <span className="badge">Untagged</span>
        ) : (
          <span className="badge wanted">{wanted} wanted</span>
        )}
      </div>
    </Link>
  )
}
