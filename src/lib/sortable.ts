import { arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type CSSProperties } from 'react'

/** For one row: put `ref` and `style` on the row, spread `handle` on the drag handle button. */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
  return { ref: setNodeRef, style, isDragging, handle: { ref: setActivatorNodeRef, ...attributes, ...listeners } }
}

/**
 * Shows a new order right away while it is saved. The saved list replaces it as soon as the
 * data changes, so there is no flicker back to the old order and no stale copy afterwards.
 */
export function useOptimisticOrder<T>(items: T[] | undefined, getId: (t: T) => string) {
  const [pending, setPending] = useState<{ base: T[]; ids: string[] }>()
  if (!items) return { ordered: undefined, show: (_ids: string[]) => {} }
  let ordered = items
  if (pending && pending.base === items) {
    const byId = new Map(items.map((t) => [getId(t), t]))
    ordered = pending.ids.map((id) => byId.get(id)).filter((t): t is T => !!t)
  }
  return { ordered, show: (ids: string[]) => setPending({ base: items, ids }) }
}

/**
 * New full order after moving `activeId` onto `overId` inside a filtered view.
 * Hidden rows keep their positions; visible rows fill the visible slots in the new order.
 */
export function moveWithin(allIds: string[], visibleIds: string[], activeId: string, overId: string): string[] {
  const moved = arrayMove(visibleIds, visibleIds.indexOf(activeId), visibleIds.indexOf(overId))
  const visible = new Set(visibleIds)
  let k = 0
  return allIds.map((id) => (visible.has(id) ? moved[k++] : id))
}
