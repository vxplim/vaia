// Moving things around the sidebar: drag and drop, pinning, folders.
// These functions change the app data directly and report whether they did.
import type { DropTarget } from '../shared/api'
import { locate, type Zone } from '../shared/tree'
import type { FolderItem, PersistedState, SidebarItem, Space, SplitItem, TabItem } from '../shared/types'
import { newId } from './store'

function tabsOf(item: SidebarItem): TabItem[] {
  if (item.kind === 'tab') return [item]
  if (item.kind === 'split') return item.tabs
  return item.children.flatMap(tabsOf)
}

function containsId(folder: FolderItem, id: string): boolean {
  return folder.children.some((c) => c.id === id || (c.kind === 'folder' && containsId(c, id)))
}

function listFor(state: PersistedState, to: DropTarget): SidebarItem[] | null {
  if (to.zone === 'favorites') return state.favorites
  const space = state.spaces.find((s) => s.id === to.spaceId)
  if (!space) return null
  if (!to.parentId) return to.zone === 'today' ? space.today : space.pinned
  const loc = locate(state, to.parentId)
  return loc && loc.item.kind === 'folder' ? loc.item.children : null
}

/** Pinned tabs and favorites remember the page they were pinned on; Today tabs don't. */
function updatePinnedUrls(item: SidebarItem, zone: Zone): void {
  for (const tab of tabsOf(item)) {
    if (zone === 'today') delete tab.pinnedUrl
    else tab.pinnedUrl ??= tab.url
  }
}

export function moveItem(state: PersistedState, id: string, to: DropTarget): boolean {
  // Dragging one tab out of a split: separate it first, then move it like any tab.
  if (locate(state, id)?.split) detachFromSplit(state, id)
  const from = locate(state, id)
  if (!from || from.split) return false
  const item = from.item
  if (to.zone === 'favorites' && item.kind !== 'tab') return false
  if (to.parentId && (to.parentId === id || (item.kind === 'folder' && containsId(item, to.parentId)))) return false
  const target = listFor(state, to)
  if (!target) return false

  from.list.splice(from.index, 1)
  let index = to.index
  if (from.list === target && from.index < index) index--
  target.splice(Math.max(0, Math.min(index, target.length)), 0, item)
  updatePinnedUrls(item, to.zone)

  // If the item was on screen in another Space, that Space no longer shows it.
  const toSpace = to.zone === 'favorites' ? null : state.spaces.find((s) => s.id === to.spaceId)
  if (from.space && toSpace && from.space !== toSpace && from.space.activeId === id) {
    from.space.activeId = null
  }
  return true
}

export function pinTab(state: PersistedState, id: string, space: Space): boolean {
  return moveItem(state, id, { zone: 'pinned', spaceId: space.id, parentId: null, index: space.pinned.length })
}

export function unpinTab(state: PersistedState, id: string, space: Space): boolean {
  return moveItem(state, id, { zone: 'today', spaceId: space.id, parentId: null, index: 0 })
}

export function addFavorite(state: PersistedState, id: string, space: Space): boolean {
  return moveItem(state, id, { zone: 'favorites', spaceId: space.id, parentId: null, index: state.favorites.length })
}

export function newFolder(space: Space, name = 'New Folder'): FolderItem {
  const folder: FolderItem = { kind: 'folder', id: newId(), name, collapsed: false, children: [] }
  space.pinned.push(folder)
  return folder
}

/** Deleting a folder keeps its tabs: they move up to where the folder was. */
export function deleteFolder(state: PersistedState, id: string): boolean {
  const loc = locate(state, id)
  if (!loc || loc.item.kind !== 'folder') return false
  loc.list.splice(loc.index, 1, ...loc.item.children)
  return true
}

// ---------- Split View ----------

export const MAX_SPLIT = 4

const evenSizes = (n: number) => Array.from({ length: n }, () => 1 / n)

/** A split with only one tab left turns back into a plain tab. Returns what's left in its place. */
function tidySplit(state: PersistedState, split: SplitItem): SidebarItem | null {
  const loc = locate(state, split.id)
  if (!loc) return null
  if (split.tabs.length === 0) {
    loc.list.splice(loc.index, 1)
    return null
  }
  if (split.tabs.length === 1) {
    const [only] = split.tabs
    loc.list.splice(loc.index, 1, only)
    if (loc.space?.activeId === split.id) loc.space.activeId = only.id
    return only
  }
  if (!split.tabs.some((t) => t.id === split.focusedId)) split.focusedId = split.tabs[0].id
  split.sizes = evenSizes(split.tabs.length)
  return split
}

/**
 * Show `add` next to the item with id `baseId` (a tab or an existing split).
 * The new pane goes on the left or right side.
 */
export function addToSplit(
  state: PersistedState,
  baseId: string,
  add: TabItem,
  side: 'left' | 'right'
): SplitItem | null {
  const base = locate(state, baseId)
  if (!base || base.zone === 'favorites') return null
  if (base.item.kind === 'split') {
    const split = base.item
    if (split.tabs.length >= MAX_SPLIT) return null
    if (side === 'left') split.tabs.unshift(add)
    else split.tabs.push(add)
    split.sizes = evenSizes(split.tabs.length)
    split.focusedId = add.id
    return split
  }
  if (base.item.kind !== 'tab') return null
  const tabs = side === 'left' ? [add, base.item] : [base.item, add]
  const split: SplitItem = { kind: 'split', id: newId(), tabs, sizes: evenSizes(2), focusedId: add.id }
  base.list.splice(base.index, 1, split)
  if (base.space && base.space.activeId === base.item.id) base.space.activeId = split.id
  return split
}

/** Take one tab out of its split; it's placed right after the split. */
export function detachFromSplit(state: PersistedState, tabId: string): TabItem | null {
  const loc = locate(state, tabId)
  if (!loc?.split || loc.item.kind !== 'tab') return null
  const split = loc.split
  const tab = loc.item
  split.tabs.splice(loc.index, 1)
  const splitLoc = locate(state, split.id)
  if (splitLoc) splitLoc.list.splice(splitLoc.index + 1, 0, tab)
  tidySplit(state, split)
  return tab
}

/** Close one tab that lives in a split (the others stay together). */
export function removeFromSplit(state: PersistedState, tabId: string): TabItem | null {
  const loc = locate(state, tabId)
  if (!loc?.split || loc.item.kind !== 'tab') return null
  loc.split.tabs.splice(loc.index, 1)
  tidySplit(state, loc.split)
  return loc.item
}

/** Turn a split back into separate tabs, in the same place. */
export function dissolveSplit(state: PersistedState, splitId: string): void {
  const loc = locate(state, splitId)
  if (!loc || loc.item.kind !== 'split') return
  const split = loc.item
  loc.list.splice(loc.index, 1, ...split.tabs)
  if (loc.space?.activeId === split.id) loc.space.activeId = split.focusedId ?? split.tabs[0]?.id ?? null
}
