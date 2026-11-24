import type { Status } from '../data/types'

export function StatusToggle({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Status">
      {(['owned', 'wanted'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          className={value === s ? `on ${s}` : ''}
          onClick={() => onChange(s)}
        >
          {s === 'owned' ? 'Owned' : 'Wanted'}
        </button>
      ))}
    </div>
  )
}
