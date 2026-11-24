import { useMemo } from 'react'
import { useLookSummaries } from '../data/hooks'
import { computeStats, type TagCount } from '../lib/stats'

export function Stats() {
  const looks = useLookSummaries()
  const stats = useMemo(() => (looks ? computeStats(looks) : undefined), [looks])
  if (!stats) return <main className="page" />

  const top = stats.combos[0] ?? stats.styles[0]
  return (
    <main className="page">
      <h1>Style stats</h1>
      {stats.totalLooks === 0 ? (
        <p className="empty">Add and tag some looks to see stats.</p>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="tile"><span className="tile-num">{stats.totalLooks}</span><span>looks</span></div>
            <div className="tile"><span className="tile-num">{stats.completeLooks}</span><span>complete</span></div>
          </div>
          {top && (
            <p className="headline">
              Most looks use <strong>{top.tag}</strong> ({top.count} of {stats.totalLooks}).
            </p>
          )}
          <CountTable title="Style + category" rows={stats.combos} total={stats.totalLooks} />
          <CountTable title="Categories" rows={stats.categories} total={stats.totalLooks} />
          <CountTable title="Styles" rows={stats.styles} total={stats.totalLooks} />
        </>
      )}
    </main>
  )
}

function CountTable({ title, rows, total }: { title: string; rows: TagCount[]; total: number }) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2>{title}</h2>
      <table className="table">
        <thead><tr><th>Tag</th><th className="num">Looks</th><th className="bar-col" aria-hidden /></tr></thead>
        <tbody>
          {rows.slice(0, 15).map((r) => (
            <tr key={r.tag}>
              <td>{r.tag}</td>
              <td className="num">{r.count}</td>
              <td className="bar-col"><div className="bar" style={{ width: `${(r.count / total) * 100}%` }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
