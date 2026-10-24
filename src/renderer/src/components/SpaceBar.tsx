import { useEffect, useRef, useState } from 'react'
import type { AppState, Panel, Space } from '../../../shared/types'
import { useDnd } from '../dnd'
import { newMenu, spaceMenu, type SpaceMenuUi } from '../menus'
import { dispatch } from '../state'
import { dueCount } from '../todos'
import { DownloadsPopover } from './DownloadsView'
import { IconCheckCircle, IconDownload, IconLibrary, IconPlus } from './Icons'

interface Props {
  state: AppState
  menuUi: SpaceMenuUi
  onOpenPanel: (panel: Panel) => void
}

/** The row of Space icons at the bottom of the sidebar. */
export function SpaceBar({ state, menuUi, onOpenPanel }: Props) {
  const onEdit = menuUi.editSpace
  const active = state.downloads.filter((d) => d.state === 'progressing')
  const progress = active.reduce((sum, d) => sum + (d.total ? d.received / d.total : 0), 0) / (active.length || 1)
  return (
    <div className="space-bar">
      <button className="icon-button" title="Library (⇧⌘L)" onClick={() => menuUi.openLibrary()}>
        <IconLibrary />
      </button>
      <DownloadsButton
        state={state}
        busy={active.length > 0}
        progress={progress}
        onOpen={() => menuUi.openLibrary('downloads')}
      />
      <TodoButton state={state} onOpen={() => onOpenPanel('todo')} />
      <div className="space-icons">
        {state.spaces.map((space, i) => (
          <SpaceIcon
            key={space.id}
            space={space}
            index={i}
            count={state.spaces.length}
            active={space.id === state.activeSpaceId}
            menuUi={menuUi}
          />
        ))}
      </div>
      <button
        className="icon-button"
        title="New tab, note, Easel, folder, Space…"
        onClick={() =>
          newMenu({
            newFolder: () => menuUi.newFolder(state.activeSpaceId),
            newLiveFolder: () => menuUi.newLiveFolder(state.activeSpaceId),
            newSpace: async () => onEdit((await dispatch({ type: 'space/new' })) as string, true)
          })
        }
      >
        <IconPlus />
      </button>
    </div>
  )
}

const POPOVER_OPEN_MS = 250
const POPOVER_CLOSE_MS = 220

/** Hover for your latest downloads; click for the full Downloads page. */
function DownloadsButton({ state, busy, progress, onOpen }: { state: AppState; busy: boolean; progress: number; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  return (
    <div
      className="downloads-anchor"
      onMouseEnter={() => later(() => setOpen(true), open ? 0 : POPOVER_OPEN_MS)}
      onMouseLeave={() => later(() => setOpen(false), POPOVER_CLOSE_MS)}
    >
      <button
        className={`icon-button downloads-button${busy ? ' busy' : ''}`}
        title="Downloads (⇧⌘J)"
        onClick={() => {
          setOpen(false)
          onOpen()
        }}
        style={{ '--progress': `${Math.round(progress * 100)}%` } as React.CSSProperties}
      >
        <IconDownload />
      </button>
      {open && (
        <DownloadsPopover
          state={state}
          onShowAll={() => {
            setOpen(false)
            onOpen()
          }}
        />
      )}
    </div>
  )
}

function TodoButton({ state, onOpen }: { state: AppState; onOpen: () => void }) {
  const due = dueCount(state)
  return (
    <button
      className="icon-button todo-button"
      title={due ? `To-do: ${due} due today or overdue (⇧⌘K)` : 'To-do (⇧⌘K)'}
      onClick={onOpen}
    >
      <IconCheckCircle />
      {due > 0 && <span className="todo-badge">{due > 9 ? '9+' : due}</span>}
    </button>
  )
}

function SpaceIcon({
  space,
  index,
  count,
  active,
  menuUi
}: {
  space: Space
  index: number
  count: number
  active: boolean
  menuUi: SpaceMenuUi
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
      onDoubleClick={() => menuUi.editSpace(space.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        spaceMenu(space, menuUi, [
          { label: 'Move Left', enabled: index > 0, run: () => dispatch({ type: 'space/reorder', id: space.id, index: index - 1 }) },
          { label: 'Move Right', enabled: index < count - 1, run: () => dispatch({ type: 'space/reorder', id: space.id, index: index + 1 }) }
        ])
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
