import { useState, type DragEvent } from 'react'
import type { DropTarget } from '../../../shared/api'
import type { Zone } from '../../../shared/tree'
import type { AppState, SidebarItem, Space } from '../../../shared/types'
import { confirmDeleteSpace } from '../menus'
import { dispatch } from '../state'
import { colorsToCss, themeColors } from '../theme'
import { Favicon } from './Favicon'
import { IconFolder, IconPlus } from './Icons'
import { ThemeControls } from './ThemeControls'

const ITEM_MIME = 'application/x-vaia-library-item'

type Place = Omit<DropTarget, 'index'>

/** Open a tab (or split) wherever it lives: switch to its Space and show it. */
function openItem(spaceId: string, id: string, onOpen: () => void) {
  dispatch({ type: 'tab/activate', id }).then(() => dispatch({ type: 'space/switch', id: spaceId }))
  onOpen()
}

function Rows({
  items,
  place,
  depth,
  onOpen,
  dropAt
}: {
  items: SidebarItem[]
  place: Place
  depth: number
  onOpen: () => void
  dropAt: (e: DragEvent, to: DropTarget) => void
}) {
  const [over, setOver] = useState<string | null>(null)
  const rowProps = (item: SidebarItem, index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(ITEM_MIME, item.id)
      e.dataTransfer.effectAllowed = 'move'
      e.stopPropagation()
    },
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(ITEM_MIME)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(item.id)
    },
    onDragLeave: () => setOver(null),
    // Dropping on a row puts the dragged tab just before it.
    onDrop: (e: DragEvent) => {
      setOver(null)
      dropAt(e, { ...place, index })
    },
    style: { paddingLeft: 8 + depth * 14 }
  })
  return (
    <>
      {items.map((item, index) => {
        const cls = `lib-row${over === item.id ? ' drop-before' : ''}`
        if (item.kind === 'folder') {
          return (
            <div key={item.id}>
              <div className={`${cls} lib-folder`} {...rowProps(item, index)}>
                <IconFolder />
                <span className="lib-row-title">{item.name}</span>
              </div>
              <Rows items={item.children} place={{ ...place, parentId: item.id }} depth={depth + 1} onOpen={onOpen} dropAt={dropAt} />
            </div>
          )
        }
        const tabs = item.kind === 'split' ? item.tabs : [item]
        const first = tabs[0]
        return (
          <div
            key={item.id}
            className={cls}
            role="button"
            title={tabs.map((t) => t.url || 'New Tab').join('\n')}
            onClick={() => first && openItem(place.spaceId, first.id, onOpen)}
            {...rowProps(item, index)}
          >
            {tabs.map((t) => (
              <Favicon key={t.id} src={t.favicon} url={t.url} />
            ))}
            <span className="lib-row-title">{tabs.map((t) => t.name || t.title || 'New Tab').join(' + ')}</span>
          </div>
        )
      })}
    </>
  )
}

function Column({ state, space, onOpen }: { state: AppState; space: Space; onOpen: () => void }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(space.name)
  const [themeOpen, setThemeOpen] = useState(false)
  const [overZone, setOverZone] = useState<Zone | null>(null)
  const active = space.id === state.activeSpaceId

  const dropAt = (e: DragEvent, to: DropTarget) => {
    const id = e.dataTransfer.getData(ITEM_MIME)
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    setOverZone(null)
    dispatch({ type: 'item/move', id, to })
  }
  // Dropping on the empty part of a list adds the tab at the end.
  const zoneProps = (zone: Zone, list: SidebarItem[]) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(ITEM_MIME)) return
      e.preventDefault()
      setOverZone(zone)
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverZone(null)
    },
    onDrop: (e: DragEvent) => dropAt(e, { zone, spaceId: space.id, parentId: null, index: list.length })
  })
  const commitName = () => {
    setRenaming(false)
    if (name.trim() && name !== space.name) dispatch({ type: 'space/update', id: space.id, patch: { name } })
    else setName(space.name)
  }

  return (
    <div className={`lib-column${active ? ' active' : ''}`}>
      <div className="lib-column-swatch" style={{ background: colorsToCss(themeColors(space.theme)) }} />
      <div className="lib-column-head">
        <span className="lib-column-icon">{space.icon}</span>
        {renaming ? (
          <input
            className="text-field small"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setName(space.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <span className="lib-column-name" onDoubleClick={() => setRenaming(true)}>
            {space.name}
          </span>
        )}
        {space.profileId && <span className="lib-column-tag" title="This Space uses its own account">Own account</span>}
      </div>
      <div className="lib-column-actions">
        <button className="text-button small" onClick={() => setRenaming(true)}>
          Rename
        </button>
        <button className={`text-button small${themeOpen ? ' on' : ''}`} onClick={() => setThemeOpen((o) => !o)}>
          Theme
        </button>
        <button
          className="text-button small danger"
          disabled={state.spaces.length < 2}
          title={state.spaces.length < 2 ? 'You need at least one Space' : undefined}
          onClick={() => confirmDeleteSpace(state, space)}
        >
          Delete
        </button>
      </div>
      {themeOpen && (
        <div className="lib-column-theme">
          <ThemeControls theme={space.theme} onChange={(patch) => dispatch({ type: 'space/update', id: space.id, patch: { theme: patch } })} />
        </div>
      )}
      <div className="lib-column-body">
        <div className={`lib-zone${overZone === 'pinned' ? ' drop-area' : ''}`} {...zoneProps('pinned', space.pinned)}>
          <h3>Pinned</h3>
          <Rows items={space.pinned} place={{ zone: 'pinned', spaceId: space.id, parentId: null }} depth={0} onOpen={onOpen} dropAt={dropAt} />
          {space.pinned.length === 0 && <div className="lib-empty">Drag tabs here to pin them</div>}
        </div>
        <div className={`lib-zone grow${overZone === 'today' ? ' drop-area' : ''}`} {...zoneProps('today', space.today)}>
          <h3>Today</h3>
          <Rows items={space.today} place={{ zone: 'today', spaceId: space.id, parentId: null }} depth={0} onOpen={onOpen} dropAt={dropAt} />
          {space.today.length === 0 && <div className="lib-empty">No open tabs</div>}
        </div>
      </div>
    </div>
  )
}

/** Library → Spaces: every Space side by side. Drag tabs between them. */
export function SpacesView({
  state,
  onOpen,
  onNewSpace
}: {
  state: AppState
  /** A tab was opened: close the Library. */
  onOpen: () => void
  onNewSpace: (id: string) => void
}) {
  return (
    <div className="library-section spaces-section">
      <div className="list-panel-head">
        <h2>Spaces</h2>
        <span className="field-hint">Drag tabs between Spaces. Double-click a name to rename it.</span>
      </div>
      <div className="lib-columns">
        {state.spaces.map((space) => (
          <Column key={space.id} state={state} space={space} onOpen={onOpen} />
        ))}
        <button
          className="lib-new-space"
          onClick={async () => onNewSpace((await dispatch({ type: 'space/new' })) as string)}
        >
          <IconPlus />
          New Space
        </button>
      </div>
    </div>
  )
}
