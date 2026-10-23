// Drag and drop for the sidebar. While you drag, we work out where the item
// would land (before/after a row, or into a folder) and draw a line there.
import { createContext, useContext, useEffect, useState, type DragEvent, type ReactNode } from 'react'
import type { DropTarget } from '../../shared/api'
import type { SidebarItem } from '../../shared/types'
import { dispatch } from './state'

type Kind = SidebarItem['kind']

export interface Indicator {
  /** The row id (or area name) showing the line. */
  key: string
  pos: 'before' | 'after' | 'into' | 'end'
  target: DropTarget
}

interface Dnd {
  drag: { id: string; kind: Kind } | null
  indicator: Indicator | null
  setDrag: (drag: { id: string; kind: Kind } | null) => void
  setIndicator: (indicator: Indicator | null) => void
}

const DndContext = createContext<Dnd | null>(null)

export function DndProvider({ children }: { children: ReactNode }) {
  const [drag, setDrag] = useState<Dnd['drag']>(null)
  const [indicator, setIndicator] = useState<Indicator | null>(null)

  // Safety net: if the dragged row disappears mid-drag (e.g. we switched Space), its
  // "drag end" never arrives. The first normal mouse move after a drag resets things.
  useEffect(() => {
    if (!drag) return
    const reset = (e: PointerEvent) => {
      if (e.buttons === 0) {
        setDrag(null)
        setIndicator(null)
      }
    }
    window.addEventListener('pointermove', reset)
    return () => window.removeEventListener('pointermove', reset)
  }, [drag])

  return <DndContext.Provider value={{ drag, indicator, setDrag, setIndicator }}>{children}</DndContext.Provider>
}

export function useDnd(): Dnd {
  const dnd = useContext(DndContext)
  if (!dnd) throw new Error('useDnd needs a DndProvider')
  return dnd
}

/** Can this kind of item be dropped into this area? */
export function accepts(zone: DropTarget['zone'], kind: Kind, intoFolder = false): boolean {
  if (zone === 'favorites') return kind === 'tab'
  return !(intoFolder && kind === 'split')
}

function sameIndicator(a: Indicator | null, b: Indicator | null): boolean {
  return !!a && !!b && a.key === b.key && a.pos === b.pos
}

interface RowOptions {
  id: string
  kind: Kind
  url?: string
  zone: DropTarget['zone']
  spaceId: string
  parentId: string | null
  index: number
  /** Favorites are laid out in a grid: compare left/right instead of up/down. */
  horizontal?: boolean
  /** Folders accept drops into their middle. */
  folderChildren?: number
}

/** Everything a sidebar row needs to be draggable and to accept drops. */
export function useDragRow(opts: RowOptions) {
  const { drag, indicator, setDrag, setIndicator } = useDnd()

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (!drag || drag.id === opts.id) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = opts.horizontal
      ? (e.clientX - rect.left) / rect.width
      : (e.clientY - rect.top) / rect.height
    let pos: Indicator['pos'] = ratio < 0.5 ? 'before' : 'after'
    if (opts.folderChildren !== undefined && ratio > 0.25 && ratio < 0.75) pos = 'into'
    const intoFolder = pos === 'into' || opts.parentId !== null
    if (!accepts(opts.zone, drag.kind, intoFolder)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const target: DropTarget =
      pos === 'into'
        ? { zone: opts.zone, spaceId: opts.spaceId, parentId: opts.id, index: opts.folderChildren ?? 0 }
        : {
            zone: opts.zone,
            spaceId: opts.spaceId,
            parentId: opts.parentId,
            index: pos === 'before' ? opts.index : opts.index + 1
          }
    const next = { key: opts.id, pos, target }
    if (!sameIndicator(indicator, next)) setIndicator(next)
  }

  const mine = indicator?.key === opts.id ? indicator.pos : null
  return {
    draggable: true,
    dropClass: mine ? ` drop-${mine}` : '',
    dragging: drag?.id === opts.id,
    handlers: {
      onDragStart: (e: DragEvent<HTMLElement>) => {
        e.dataTransfer.effectAllowed = 'move'
        if (opts.url) {
          e.dataTransfer.setData('text/uri-list', opts.url)
          e.dataTransfer.setData('text/plain', opts.url)
        }
        // Let the browser grab the drag picture before we restyle the row.
        requestAnimationFrame(() => setDrag({ id: opts.id, kind: opts.kind }))
      },
      onDragEnd: () => {
        setDrag(null)
        setIndicator(null)
      },
      onDragOver,
      onDrop: (e: DragEvent<HTMLElement>) => dropHere(e, drag, indicator, setDrag, setIndicator)
    }
  }
}

/** For a whole area (e.g. empty space under the last pinned tab): drop at the end. */
export function useDropArea(key: string, zone: DropTarget['zone'], spaceId: string, length: number) {
  const { drag, indicator, setDrag, setIndicator } = useDnd()
  return {
    active: indicator?.key === key,
    canDrop: !!drag && accepts(zone, drag.kind),
    handlers: {
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!drag || !accepts(zone, drag.kind)) return
        e.preventDefault()
        const next: Indicator = { key, pos: 'end', target: { zone, spaceId, parentId: null, index: length } }
        if (!sameIndicator(indicator, next)) setIndicator(next)
      },
      onDrop: (e: DragEvent<HTMLElement>) => dropHere(e, drag, indicator, setDrag, setIndicator)
    }
  }
}

function dropHere(
  e: DragEvent<HTMLElement>,
  drag: Dnd['drag'],
  indicator: Indicator | null,
  setDrag: Dnd['setDrag'],
  setIndicator: Dnd['setIndicator']
): void {
  e.preventDefault()
  e.stopPropagation()
  if (drag && indicator) dispatch({ type: 'item/move', id: drag.id, to: indicator.target })
  setDrag(null)
  setIndicator(null)
}
