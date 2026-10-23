import { useEffect, useRef, useState } from 'react'
import type { AppState, FolderItem, SidebarItem, Space } from '../../../shared/types'
import { useDragRow } from '../dnd'
import { folderMenu } from '../menus'
import { dispatch } from '../state'
import { IconChevron, IconFolder } from './Icons'
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
        return null
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
    zone: 'pinned',
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
        <IconFolder className="folder-icon" />
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
          <span className="tab-title">{folder.name}</span>
        )}
      </div>
      {!folder.collapsed && (
        <div className="folder-children">
          {folder.children.length === 0 ? (
            <div className="folder-empty" style={{ paddingLeft: 32 + depth * 14 }}>
              Drag tabs here
            </div>
          ) : (
            <ItemList {...props} items={folder.children} parentId={folder.id} depth={depth + 1} />
          )}
        </div>
      )}
    </div>
  )
}
