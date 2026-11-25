import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ReactNode } from 'react'
import type { useSortableRow } from '../lib/sortable'

interface AreaProps {
  ids: string[]
  layout: 'list' | 'grid'
  /** Called after a drop that changed the order: the moved row and the row it now takes the place of. */
  onMove: (activeId: string, overId: string) => void
  children: ReactNode
}

/** Drag-and-drop area. Rows start a drag only from their handle, so the page still scrolls by touch. */
export function SortableArea({ ids, layout, onMove, children }: AreaProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export function DragHandle({ label, className = '', handle }: { label: string; className?: string; handle: ReturnType<typeof useSortableRow>['handle'] }) {
  return (
    <button type="button" className={`drag-handle ${className}`} aria-label={`Move ${label}`} {...handle}>
      ⠿
    </button>
  )
}
