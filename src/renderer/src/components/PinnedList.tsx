import { useEffect, useRef, useState } from 'react'
import type { AppState, FolderItem, SidebarItem, Space, SplitItem } from '../../../shared/types'
import { useDragRow } from '../dnd'
import { folderMenu, splitMenu } from '../menus'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { tabsIn } from '../../../shared/tree'
import { IconChevron, IconClose, IconFeed, IconFolder } from './Icons'
import { TabRow } from './TabRow'

interface ListProps {
  items: SidebarItem[]
  state: AppState
  space: Space
  zone: 'pinned' | 'today'
  parentId: string | null
  depth: number
  renamingId: string | null
  setRenamingId: (id: string | null) => void
}

/** A list of sidebar items; folders show their children indented underneath. */
export function ItemList(props: ListProps) {
  const { items, state, space, zone, parentId, depth } = props
  return (
    <>
      {items.map((item, index) => {
        if (item.kind === 'tab') {
          return (
            <TabRow
              key={item.id}
              tab={item}
              state={state}
              active={space.activeId === item.id}
              zone={zone}
              spaceId={space.id}
              parentId={parentId}
              index={index}
              depth={depth}
            />
          )
        }
        if (item.kind === 'folder') {
          return <FolderRow key={item.id} folder={item} index={index} {...props} />
        }
        return <SplitRow key={item.id} split={item} index={index} {...props} />
      })}
    </>
  )
}

function FolderRow({ folder, index, ...props }: ListProps & { folder: FolderItem; index: number }) {
  const { space, parentId, depth, renamingId, setRenamingId } = props
  const editing = renamingId === folder.id
  const [name, setName] = useState(folder.name)
  const input = useRef<HTMLInputElement>(null)
  const { draggable, dropClass, dragging, handlers } = useDragRow({
    id: folder.id,
    kind: 'folder',
    zone: props.zone,
    spaceId: space.id,
    parentId,
    index,
    folderChildren: folder.children.length
  })

  useEffect(() => {
    if (editing) {
      setName(folder.name)
      requestAnimationFrame(() => input.current?.select())
    }
  }, [editing, folder.name])

  // Live Folders: how many posts you haven't opened yet.
  const unread = folder.feed ? tabsIn(folder.children).filter((t) => t.unread).length : 0

  const commit = () => {
    if (name.trim() && name !== folder.name) dispatch({ type: 'folder/rename', id: folder.id, name })
    setRenamingId(null)
  }

  return (
    <div className="folder">
      <div
        className={`folder-row${dragging ? ' dragging' : ''}${dropClass}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        role="button"
        draggable={draggable && !editing}
        {...handlers}
        onClick={() => !editing && dispatch({ type: 'folder/toggle', id: folder.id })}
        onDoubleClick={() => setRenamingId(folder.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          folderMenu(folder, () => setRenamingId(folder.id))
        }}
      >
        <IconChevron className={`folder-chevron${folder.collapsed ? '' : ' open'}`} />
        {folder.feed ? <IconFeed className="folder-icon" /> : <IconFolder className="folder-icon" />}
        {editing ? (
          <input
            ref={input}
            className="folder-name-input"
            value={name}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setRenamingId(null)
            }}
          />
        ) : (
          <span className="tab-title" title={folder.feed ? `${folder.feed.url}${folder.feed.error ? `\n${folder.feed.error}` : ''}` : undefined}>
            {folder.name}
          </span>
        )}
        {folder.feed?.error && <span className="feed-error" title={folder.feed.error}>!</span>}
        {unread > 0 && <span className="unread-badge">{unread}</span>}
      </div>
      {!folder.collapsed && (
        <div className="folder-children">
          {folder.children.length === 0 ? (
            <div className="folder-empty" style={{ paddingLeft: 32 + depth * 14 }}>
              {folder.feed ? (folder.feed.lastChecked ? 'No posts in this feed' : 'Loading the feed…') : 'Drag tabs here'}
            </div>
          ) : (
            <ItemList {...props} items={folder.children} parentId={folder.id} depth={depth + 1} />
          )}
        </div>
      )}
    </div>
  )
}

/** A Split View shows as one row, with a segment for each tab side by side. */
function SplitRow({ split, index, ...props }: ListProps & { split: SplitItem; index: number }) {
  const { state, space, zone, parentId, depth } = props
  const active = space.activeId === split.id
  const { draggable, dropClass, dragging, handlers } = useDragRow({
    id: split.id,
    kind: 'split',
    zone,
    spaceId: space.id,
    parentId,
    index
  })
  return (
    <div
      className={`split-row${active ? ' active' : ''}${dragging ? ' dragging' : ''}${dropClass}`}
      style={{ marginLeft: depth * 14 }}
      draggable={draggable}
      {...handlers}
    >
      {split.tabs.map((tab) => (
        <div
          key={tab.id}
          className={`split-seg${active && split.focusedId === tab.id ? ' focused' : ''}`}
          role="button"
          title={tab.title}
          onClick={() => dispatch({ type: 'tab/activate', id: tab.id })}
          onContextMenu={(e) => {
            e.preventDefault()
            splitMenu(split, tab)
          }}
        >
          <span className={`tab-icon${state.runtime[tab.id]?.loading ? ' loading' : ''}`}>
            <Favicon src={tab.favicon} url={tab.url} />
          </span>
          <span className="tab-title">{tab.title}</span>
        </div>
      ))}
      <button
        className="tab-action tab-close"
        title="Separate the tabs"
        onClick={(e) => {
          e.stopPropagation()
          dispatch({ type: 'split/dissolve', id: split.id })
        }}
      >
        <IconClose />
      </button>
    </div>
  )
}
