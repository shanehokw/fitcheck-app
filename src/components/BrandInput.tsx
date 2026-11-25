import { useId, useState } from 'react'
import { usePieces } from '../data/hooks'
import { filterOptions, suggestBrands } from '../lib/pieceFilter'

interface Props {
  value: string
  onChange: (v: string) => void
}

/** Text field with up to 3 suggestions from brands already used on pieces. */
export function BrandInput({ value, onChange }: Props) {
  const pieces = usePieces()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const suggestions = open ? suggestBrands(filterOptions(pieces ?? []).brands, value) : []
  const shown = suggestions.length > 0

  function pick(b: string) {
    onChange(b)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="combo">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1)) }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(suggestions[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Uniqlo"
        aria-label="Brand"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />
      {shown && (
        <ul className="combo-list" role="listbox" id={listId}>
          {suggestions.map((b, i) => (
            <li
              key={b}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'on' : ''}
              // mousedown, not click: keeps focus in the field so blur does not close the list first
              onMouseDown={(e) => { e.preventDefault(); pick(b) }}
            >
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
