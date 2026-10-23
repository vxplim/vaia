// Right-click menus for sidebar items. The menu itself is a native Mac menu
// (drawn by the brain); here we decide what's in it and what each choice does.
import type { MenuItem } from '../../shared/api'
import type { Zone } from '../../shared/tree'
import type { FolderItem, SplitItem, TabItem } from '../../shared/types'
import { sameUrl } from '../../shared/url'
import { dispatch } from './state'

type Handlers = Record<string, () => void>

async function show(items: (MenuItem & { run?: () => void })[]): Promise<void> {
  const handlers: Handlers = {}
  const plain: MenuItem[] = items.map(({ run, ...item }, i) => {
    if (run) {
      const id = item.id ?? `item-${i}`
      handlers[id] = run
      return { ...item, id }
    }
    return item
  })
  const chosen = await window.vaia.popupMenu(plain)
  if (chosen) handlers[chosen]?.()
}

const sep = { type: 'separator' as const }

export function tabMenu(tab: TabItem, zone: Zone, loaded: boolean, active = false): Promise<void> {
  const navigatedAway = !!tab.pinnedUrl && !sameUrl(tab.url, tab.pinnedUrl)
  const id = tab.id
  const items: (MenuItem & { run?: () => void })[] = []
  if (zone === 'today') {
    items.push(
      { label: 'Pin Tab', run: () => dispatch({ type: 'tab/pin', id }) },
      { label: 'Add to Favorites', run: () => dispatch({ type: 'tab/favorite', id }) }
    )
  } else if (zone === 'pinned') {
    items.push(
      { label: 'Unpin Tab', run: () => dispatch({ type: 'tab/unpin', id }) },
      { label: 'Add to Favorites', run: () => dispatch({ type: 'tab/favorite', id }) }
    )
  } else {
    items.push({ label: 'Remove from Favorites', run: () => dispatch({ type: 'tab/unpin', id }) })
  }
  if (navigatedAway) items.push({ label: 'Return to Pinned Page', run: () => dispatch({ type: 'tab/resetPinned', id }) })
  if (!active && tab.url) {
    items.push(sep, { label: 'Open in Split View', run: () => dispatch({ type: 'split/add', tabId: id }) })
  }
  items.push(sep, { label: 'Copy Link', enabled: !!tab.url, run: () => dispatch({ type: 'tab/copyUrl', id }) }, sep)
  if (zone === 'today') {
    items.push({ label: 'Close Tab', run: () => dispatch({ type: 'tab/close', id }) })
  } else {
    items.push(
      { label: 'Put Tab to Sleep', enabled: loaded, run: () => dispatch({ type: 'tab/close', id }) },
      { label: zone === 'favorites' ? 'Delete Favorite' : 'Delete Pinned Tab', run: () => dispatch({ type: 'item/delete', id }) }
    )
  }
  return show(items)
}

export function folderMenu(folder: FolderItem, rename: () => void): Promise<void> {
  return show([
    { label: 'Rename Folder', run: rename },
    { label: folder.collapsed ? 'Expand' : 'Collapse', run: () => dispatch({ type: 'folder/toggle', id: folder.id }) },
    sep,
    { label: 'Delete Folder (keep tabs)', run: () => dispatch({ type: 'item/delete', id: folder.id }) }
  ])
}

export function pinnedAreaMenu(newFolder: () => void): Promise<void> {
  return show([{ label: 'New Folder', run: newFolder }])
}

export function splitMenu(split: SplitItem, tab: TabItem): Promise<void> {
  return show([
    { label: 'Remove from Split View', run: () => dispatch({ type: 'split/detach', tabId: tab.id }) },
    { label: 'Separate All Tabs', run: () => dispatch({ type: 'split/dissolve', id: split.id }) },
    sep,
    { label: 'Copy Link', run: () => dispatch({ type: 'tab/copyUrl', id: tab.id }) },
    { label: 'Close Tab', run: () => dispatch({ type: 'tab/close', id: tab.id }) }
  ])
}
