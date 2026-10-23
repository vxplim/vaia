import { useRef, useState } from 'react'
import type { AppState, Panel, Space } from '../../../shared/types'
import { useDnd } from '../dnd'
import { dispatch } from '../state'
import { IconArchive, IconDownload, IconPlus } from './Icons'

interface Props {
  state: AppState
  onEdit: (spaceId: string) => void
  onOpenPanel: (panel: Panel) => void
}

/** The row of Space icons at the bottom of the sidebar. */
export function SpaceBar({ state, onEdit, onOpenPanel }: Props) {
  const active = state.downloads.filter((d) => d.state === 'progressing')
  const progress = active.reduce((sum, d) => sum + (d.total ? d.received / d.total : 0), 0) / (active.length || 1)
  return (
    <div className="space-bar">
      <button className="icon-button" title="Archive" onClick={() => onOpenPanel('archive')}>
        <IconArchive />
      </button>
      <button
        className={`icon-button downloads-button${active.length ? ' busy' : ''}`}
        title="Downloads (⇧⌘J)"
        onClick={() => onOpenPanel('downloads')}
        style={{ '--progress': `${Math.round(progress * 100)}%` } as React.CSSProperties}
      >
        <IconDownload />
      </button>
      <div className="space-icons">
        {state.spaces.map((space, i) => (
          <SpaceIcon key={space.id} space={space} index={i} active={space.id === state.activeSpaceId} onEdit={onEdit} />
        ))}
      </div>
      <button
        className="icon-button"
        title="New Space"
        onClick={async () => {
          const id = (await dispatch({ type: 'space/new' })) as string
          onEdit(id)
        }}
      >
        <IconPlus />
      </button>
    </div>
  )
}

function SpaceIcon({
  space,
  index,
  active,
  onEdit
}: {
  space: Space
  index: number
  active: boolean
  onEdit: (id: string) => void
}) {
  const { drag, setDrag, setIndicator } = useDnd()
  const [over, setOver] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canTakeTab = drag?.kind === 'tab'

  const leave = () => {
    setOver(false)
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }

  return (
    <button
      className={`space-icon${active ? ' active' : ''}${over ? ' drop-into' : ''}`}
      title={`${space.name} (⌃${index + 1})`}
      onClick={() => dispatch({ type: 'space/switch', id: space.id })}
      onDoubleClick={() => onEdit(space.id)}
      onContextMenu={async (e) => {
        e.preventDefault()
        const choice = await window.vaia.popupMenu([
          { id: 'edit', label: 'Edit Space…' },
          { type: 'separator' },
          { id: 'left', label: 'Move Left', enabled: index > 0 },
          { id: 'right', label: 'Move Right' }
        ])
        if (choice === 'edit') onEdit(space.id)
        if (choice === 'left') dispatch({ type: 'space/reorder', id: space.id, index: index - 1 })
        if (choice === 'right') dispatch({ type: 'space/reorder', id: space.id, index: index + 1 })
      }}
      // Drop a tab on a Space icon to move it there; hover a moment to switch to that Space.
      onDragOver={(e) => {
        if (!canTakeTab) return
        e.preventDefault()
        if (!over) setOver(true)
        if (!hoverTimer.current && !active) {
          hoverTimer.current = setTimeout(() => dispatch({ type: 'space/switch', id: space.id }), 700)
        }
      }}
      onDragLeave={leave}
      onDrop={(e) => {
        e.preventDefault()
        leave()
        if (drag) dispatch({ type: 'tab/moveToSpace', id: drag.id, spaceId: space.id })
        setDrag(null)
        setIndicator(null)
      }}
    >
      {space.icon}
    </button>
  )
}
