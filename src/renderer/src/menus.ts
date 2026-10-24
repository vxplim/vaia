// Right-click menus for sidebar items. The menu itself is a native Mac menu
// (drawn by the brain); here we decide what's in it and what each choice does.
import type { MenuItem } from '../../shared/api'
import type { Zone } from '../../shared/tree'
import { tabsIn } from '../../shared/tree'
import type { AppState, FolderItem, LibrarySection, Space, SplitItem, TabItem } from '../../shared/types'
import { sameUrl } from '../../shared/url'
import { applyLayoutChoice, layoutMenuItems } from './splitLayouts'
import { dispatch, getAppState } from './state'

type Handlers = Record<string, () => void>

type RunItem = Omit<MenuItem, 'submenu'> & { run?: () => void; submenu?: RunItem[] }

async function show(items: RunItem[], moveTabId?: string): Promise<void> {
  const handlers: Handlers = {}
  let n = 0
  // Items with a run() get an id; the chosen id runs its handler (also inside submenus).
  const strip = (list: RunItem[]): MenuItem[] =>
    list.map(({ run, submenu, ...item }) => {
      const plain: MenuItem = submenu ? { ...item, submenu: strip(submenu) } : item
      if (!run) return plain
      const id = item.id ?? `item-${n++}`
      handlers[id] = run
      return { ...plain, id }
    })
  const plain = strip(items)
  const chosen = await window.vaia.popupMenu(plain)
  if (moveTabId && applyLayoutChoice(chosen, moveTabId)) return
  if (chosen?.startsWith('move-') && moveTabId) {
    dispatch({ type: 'tab/moveToSpace', id: moveTabId, spaceId: chosen.slice(5) })
  } else if (chosen) handlers[chosen]?.()
}

const sep = { type: 'separator' as const }

/** "Move to Space ▸" with every other Space. */
function moveToSpaceItem(tabId: string): RunItem {
  const state = getAppState()
  const others = state ? state.spaces.filter((s) => s.id !== state.activeSpaceId) : []
  return {
    label: 'Move to Space',
    enabled: others.length > 0,
    submenu: others.map((s) => ({ id: `move-${s.id}`, label: `${s.icon}  ${s.name}` }))
  }
}

export function tabMenu(tab: TabItem, zone: Zone, loaded: boolean, active = false, rename?: () => void): Promise<void> {
  const navigatedAway = !!tab.pinnedUrl && !sameUrl(tab.url, tab.pinnedUrl)
  const id = tab.id
  const items: RunItem[] = []
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
  items.push(sep)
  if (!active && tab.url) items.push({ label: 'Open in Split View', run: () => dispatch({ type: 'split/add', tabId: id }) })
  if (tab.url && !tab.url.startsWith('vaia:')) items.push({ label: 'Open in Side Panel', run: () => dispatch({ type: 'sidePanel/open', tabId: id }) })
  if (zone !== 'favorites') {
    const loc = getAppState()?.spaces.flatMap((s) => [...s.pinned, ...s.today]).find((i) => i.kind === 'split' && i.tabs.some((t) => t.id === id))
    items.push({ label: 'Split View Layout', submenu: layoutMenuItems(loc?.kind === 'split' ? loc : null) })
  }
  const rt = getAppState()?.runtime[id]
  items.push(sep)
  if (rename) items.push({ label: 'Rename…', run: rename })
  if (tab.customName) items.push({ label: 'Reset Name', run: () => dispatch({ type: 'tab/rename', id, name: null }) })
  items.push(
    { label: rt?.muted ? 'Unmute Tab' : 'Mute Tab', enabled: loaded, run: () => dispatch({ type: 'tab/mute', id, muted: !rt?.muted }) },
    { label: 'Duplicate', enabled: !!tab.url && !tab.url.startsWith('vaia:'), run: () => dispatch({ type: 'tab/duplicate', id }) },
    { label: 'Copy Link', enabled: !!tab.url, run: () => dispatch({ type: 'tab/copyUrl', id }) }
  )
  if (zone !== 'favorites') items.push(moveToSpaceItem(id))
  items.push(sep)
  if (zone === 'today') {
    items.push({ label: 'Close Tab', run: () => dispatch({ type: 'tab/close', id }) })
  } else {
    items.push(
      { label: 'Put Tab to Sleep', enabled: loaded, run: () => dispatch({ type: 'tab/close', id }) },
      { label: zone === 'favorites' ? 'Delete Favorite' : 'Delete Pinned Tab', run: () => dispatch({ type: 'item/delete', id }) }
    )
  }
  return show(items, id)
}

export function folderMenu(folder: FolderItem, rename: () => void): Promise<void> {
  const live: RunItem[] = folder.feed
    ? [
        { label: 'Refresh Now', run: () => dispatch({ type: 'liveFolder/refresh', id: folder.id }) },
        { label: 'Mark All as Read', run: () => dispatch({ type: 'liveFolder/markAllRead', id: folder.id }) },
        sep
      ]
    : []
  return show([
    ...live,
    { label: 'Rename Folder', run: rename },
    { label: folder.collapsed ? 'Expand' : 'Collapse', run: () => dispatch({ type: 'folder/toggle', id: folder.id }) },
    sep,
    { label: 'Delete Folder (keep tabs)', run: () => dispatch({ type: 'item/delete', id: folder.id }) }
  ])
}

export function pinnedAreaMenu(newFolder: () => void, newLiveFolder: () => void): Promise<void> {
  return show([
    { label: 'New Folder', run: newFolder },
    { label: 'New Live Folder…', run: newLiveFolder },
    { label: 'New Note', run: () => dispatch({ type: 'doc/new', kind: 'note' }) },
    { label: 'New Easel', run: () => dispatch({ type: 'doc/new', kind: 'easel' }) }
  ])
}

/** The + at the bottom of the sidebar: everything you can make. */
export function newMenu(ui: { newFolder: () => void; newLiveFolder: () => void; newSpace: () => void }): Promise<void> {
  return show([
    { label: 'New Tab', run: () => dispatch({ type: 'tab/new' }) },
    { label: 'New Note', run: () => dispatch({ type: 'doc/new', kind: 'note' }) },
    { label: 'New Easel', run: () => dispatch({ type: 'doc/new', kind: 'easel' }) },
    sep,
    { label: 'New Folder', run: ui.newFolder },
    { label: 'New Live Folder…', run: ui.newLiveFolder },
    sep,
    { label: 'New Space…', run: ui.newSpace },
    { label: 'New Little Window', run: () => dispatch({ type: 'little/new' }) },
    { label: 'New Private Window', run: () => dispatch({ type: 'private/new' }) }
  ])
}

export function splitMenu(split: SplitItem, tab: TabItem): Promise<void> {
  return show([
    { label: 'Layout', submenu: layoutMenuItems(split) },
    sep,
    { label: 'Remove from Split View', run: () => dispatch({ type: 'split/detach', tabId: tab.id }) },
    { label: 'Separate All Tabs', run: () => dispatch({ type: 'split/dissolve', id: split.id }) },
    sep,
    { label: 'Copy Link', run: () => dispatch({ type: 'tab/copyUrl', id: tab.id }) },
    { label: 'Close Tab', run: () => dispatch({ type: 'tab/close', id: tab.id }) }
  ], tab.id)
}

/** Which part of the Space editor to start in. */
export type SpaceEditorFocus = 'icon' | 'name' | 'theme'

export interface SpaceMenuUi {
  editSpace: (spaceId: string, setup?: boolean, focus?: SpaceEditorFocus) => void
  openLibrary: (section?: LibrarySection) => void
  newFolder: (spaceId: string) => void
  newLiveFolder: (spaceId?: string) => void
}

/** Ask first, then delete a Space (its tabs close; a separate account's logins are removed). */
export function confirmDeleteSpace(state: AppState, space: Space): void {
  if (state.spaces.length < 2) return
  const tabs = tabsIn(space.pinned).length + tabsIn(space.today).length
  const lines = [`Delete the Space “${space.name}”?`, '']
  lines.push(tabs ? `Its ${tabs} tab${tabs === 1 ? '' : 's'} will be closed.` : 'It has no tabs.')
  if (space.profileId) lines.push('Its separate account (logins, cookies and saved passwords) will be removed too.')
  lines.push('Its to-dos move to “Everywhere”.')
  if (confirm(lines.join('\n'))) dispatch({ type: 'space/delete', id: space.id })
}

/** Switch a Space between the shared account and its own (asks before deleting its own logins). */
function setProfile(space: Space, separate: boolean): void {
  if (separate === !!space.profileId) return
  if (!separate && !confirm(`Switch “${space.name}” to the shared account?\n\nIts separate logins, cookies and saved passwords will be removed, and its tabs will reload.`)) return
  dispatch({ type: 'space/setProfile', id: space.id, separate })
}

/** The Space menu: the ⋯ next to the Space name, and right-clicking a Space icon. */
export function spaceMenu(space: Space, ui: SpaceMenuUi, extra: RunItem[] = []): Promise<void> {
  const state = getAppState()
  const id = space.id
  return show([
    { label: 'Change Icon…', run: () => ui.editSpace(id, false, 'icon') },
    { label: 'Rename…', run: () => ui.editSpace(id, false, 'name') },
    { label: 'Edit Theme…', run: () => ui.editSpace(id, false, 'theme') },
    {
      label: 'Set Profile',
      submenu: [
        { label: 'Shared Default Account', checked: !space.profileId, run: () => setProfile(space, false) },
        { label: 'Separate Account for This Space', checked: !!space.profileId, run: () => setProfile(space, true) },
        sep,
        { label: 'Sign in with Google…', run: () => dispatch({ type: 'space/signInGoogle', id }) }
      ]
    },
    sep,
    { label: 'New Folder', run: () => ui.newFolder(id) },
    { label: 'Export Tabs as Bookmarks…', run: () => dispatch({ type: 'space/exportBookmarks', id }) },
    { label: 'Manage Spaces…', run: () => ui.openLibrary('spaces') },
    ...(extra.length ? [sep, ...extra] : []),
    sep,
    { label: 'Delete Space…', enabled: (state?.spaces.length ?? 0) > 1, run: () => state && confirmDeleteSpace(state, space) }
  ]).then(() => undefined)
}
