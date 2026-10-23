// Helpers for finding and moving items inside the sidebar's nested lists
// (folders contain items; split groups contain tabs).
import type { PersistedState, SidebarItem, Space, SplitItem, TabItem } from './types'

export type Zone = 'favorites' | 'pinned' | 'today'

export interface Location {
  item: SidebarItem
  /** The array that directly holds the item. */
  list: SidebarItem[]
  index: number
  zone: Zone
  /** null for favorites (shared by all spaces). */
  space: Space | null
  /** Set when the item is a tab inside a split group. */
  split: SplitItem | null
}

function search(
  list: SidebarItem[],
  id: string,
  zone: Zone,
  space: Space | null,
  split: SplitItem | null
): Location | null {
  for (let index = 0; index < list.length; index++) {
    const item = list[index]
    if (item.id === id) return { item, list, index, zone, space, split }
    if (item.kind === 'folder') {
      const found = search(item.children, id, zone, space, null)
      if (found) return found
    } else if (item.kind === 'split') {
      const found = search(item.tabs, id, zone, space, item)
      if (found) return found
    }
  }
  return null
}

export function locate(state: PersistedState, id: string): Location | null {
  const fav = search(state.favorites, id, 'favorites', null, null)
  if (fav) return fav
  for (const space of state.spaces) {
    const found = search(space.pinned, id, 'pinned', space, null) ?? search(space.today, id, 'today', space, null)
    if (found) return found
  }
  return null
}

export function tabsIn(list: SidebarItem[]): TabItem[] {
  const out: TabItem[] = []
  for (const item of list) {
    if (item.kind === 'tab') out.push(item)
    else if (item.kind === 'folder') out.push(...tabsIn(item.children))
    else out.push(...item.tabs)
  }
  return out
}

export function allTabs(state: PersistedState): TabItem[] {
  return [...state.favorites, ...state.spaces.flatMap((s) => [...tabsIn(s.pinned), ...tabsIn(s.today)])]
}

export function activeSpace(state: PersistedState): Space {
  return state.spaces.find((s) => s.id === state.activeSpaceId) ?? state.spaces[0]
}

/** The tab ids that are on screen for a space (one tab, or all tabs of a split). */
export function visibleTabIds(state: PersistedState, space: Space): string[] {
  if (!space.activeId) return []
  const loc = locate(state, space.activeId)
  if (!loc) return []
  if (loc.item.kind === 'tab') return [loc.item.id]
  if (loc.item.kind === 'split') return loc.item.tabs.map((t) => t.id)
  return []
}
