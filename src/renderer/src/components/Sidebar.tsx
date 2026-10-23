import { useEffect, useRef, useState, type WheelEvent } from 'react'
import type { AppState, Space, TabItem } from '../../../shared/types'
import { DndProvider, useDropArea } from '../dnd'
import { pinnedAreaMenu } from '../menus'
import { dispatch } from '../state'
import { Favorites, FavoritesDropZone } from './Favorites'
import { IconBack, IconForward, IconMore, IconPlus, IconReload, IconStop } from './Icons'
import { ItemList } from './PinnedList'
import { SpaceBar } from './SpaceBar'
import { UrlBar } from './UrlBar'

interface Props {
  state: AppState
  space: Space
  activeTab: TabItem | null
  urlEditing: boolean
  setUrlEditing: (editing: boolean) => void
  onNewTab: () => void
  onEditSpace: (spaceId: string) => void
  onOpenArchive: () => void
}

export function Sidebar(props: Props) {
  return (
    <DndProvider>
      <SidebarInner {...props} />
    </DndProvider>
  )
}

/** Two-finger horizontal swipes on the sidebar switch Spaces. */
function useSwipe(onSwipe: (delta: 1 | -1) => void) {
  const acc = useRef(0)
  const locked = useRef(false)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)
  return (e: WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    // One gesture = one switch: wait until the fingers stop before allowing another.
    if (idle.current) clearTimeout(idle.current)
    idle.current = setTimeout(() => {
      acc.current = 0
      locked.current = false
    }, 220)
    if (locked.current) return
    acc.current += e.deltaX
    if (Math.abs(acc.current) > 70) {
      locked.current = true
      onSwipe(acc.current > 0 ? 1 : -1)
    }
  }
}

function SidebarInner({ state, space, activeTab, urlEditing, setUrlEditing, onNewTab, onEditSpace, onOpenArchive }: Props) {
  const spaceIndex = state.spaces.findIndex((s) => s.id === space.id)
  // Slide the tab list in from the side the new Space is on.
  const lastIndex = useRef(spaceIndex)
  const direction = spaceIndex >= lastIndex.current ? 'right' : 'left'
  useEffect(() => {
    lastIndex.current = spaceIndex
  }, [spaceIndex])
  const onWheel = useSwipe((delta) => dispatch({ type: 'space/switchRelative', delta }))
  const rt = activeTab ? state.runtime[activeTab.id] : undefined
  const id = activeTab?.id
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const pinnedArea = useDropArea('pinned-end', 'pinned', space.id, space.pinned.length)
  const todayArea = useDropArea('today-end', 'today', space.id, space.today.length)

  const newFolder = async () => {
    const folderId = (await dispatch({ type: 'folder/new' })) as string
    setRenamingId(folderId)
  }
  const listProps = { state, space, renamingId, setRenamingId, depth: 0, parentId: null }

  return (
    <aside className="sidebar" style={{ width: state.settings.sidebarWidth }} onWheel={onWheel}>
      <div className="sidebar-top">
        <div className="nav-buttons">
          <button
            className="icon-button"
            title="Back (⌘[)"
            disabled={!rt?.canGoBack}
            onClick={() => id && dispatch({ type: 'tab/back', id })}
          >
            <IconBack />
          </button>
          <button
            className="icon-button"
            title="Forward (⌘])"
            disabled={!rt?.canGoForward}
            onClick={() => id && dispatch({ type: 'tab/forward', id })}
          >
            <IconForward />
          </button>
          <button
            className="icon-button"
            title={rt?.loading ? 'Stop' : 'Reload (⌘R)'}
            disabled={!activeTab?.url}
            onClick={() => id && dispatch({ type: rt?.loading ? 'tab/stop' : 'tab/reload', id })}
          >
            {rt?.loading ? <IconStop /> : <IconReload />}
          </button>
        </div>
      </div>

      <div className="urlbar-wrap">
        <UrlBar tab={activeTab} editing={urlEditing} setEditing={setUrlEditing} />
        <FavoritesDropZone state={state} space={space} />
      </div>

      <Favorites state={state} space={space} />

      <div className={`sidebar-scroll slide-${direction}`} key={space.id}>
        <div className="space-header" onDoubleClick={() => onEditSpace(space.id)}>
          <span className="space-header-name">{space.name}</span>
          <button className="icon-button small" title="Edit Space" onClick={() => onEditSpace(space.id)}>
            <IconMore />
          </button>
        </div>

        <section
          className={`pinned${pinnedArea.active ? ' drop-area' : ''}`}
          {...pinnedArea.handlers}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault()
              pinnedAreaMenu(newFolder)
            }
          }}
        >
          <ItemList {...listProps} items={space.pinned} zone="pinned" />
          {space.pinned.length === 0 && (
            <div className="pinned-empty">{pinnedArea.canDrop ? 'Drop here to pin' : 'Drag tabs here to pin them'}</div>
          )}
        </section>

        <div className="today-divider">
          <span className="divider-line" />
          {space.today.length > 0 && (
            <button className="clear-button" title="Close all Today tabs" onClick={() => dispatch({ type: 'today/clear' })}>
              Clear
            </button>
          )}
        </div>

        <section className={`today${todayArea.active ? ' drop-area' : ''}`} {...todayArea.handlers}>
          <button className="new-tab-row" onClick={onNewTab}>
            <IconPlus />
            <span>New Tab</span>
          </button>
          <div className="tab-list">
            <ItemList {...listProps} items={space.today} zone="today" />
          </div>
        </section>
      </div>

      <SpaceBar state={state} onEdit={onEditSpace} onOpenArchive={onOpenArchive} />
    </aside>
  )
}
