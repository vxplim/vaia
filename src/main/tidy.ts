// Tidy: tame a messy Today list. Simple Tidy groups tabs from the same website
// into folders and closes exact duplicates; AI Tidy applies topic folders and
// shorter names suggested by Claude (see ai.ts). Both only rearrange Today.
import type { FolderItem, SidebarItem, Space, TabItem } from '../shared/types'
import { siteKey } from '../shared/url'
import { newId } from './store'

export interface TidyResult {
  /** Duplicate tabs that were closed. */
  removed: TabItem[]
  /** Folders that were created or added to. */
  folders: number
  changed: boolean
}

/** Plain tabs in Today, including those inside folders (splits are left alone). */
function looseTabs(list: SidebarItem[]): TabItem[] {
  return list.flatMap((item) => (item.kind === 'tab' ? [item] : item.kind === 'folder' ? looseTabs(item.children) : []))
}

function removeIds(list: SidebarItem[], ids: Set<string>): SidebarItem[] {
  return list
    .filter((item) => !ids.has(item.id))
    .map((item) => (item.kind === 'folder' ? { ...item, children: removeIds(item.children, ids) } : item))
}

function newFolder(name: string): FolderItem {
  return { kind: 'folder', id: newId(), name, collapsed: false, children: [] }
}

/** Close tabs whose address exactly matches an earlier one (the tab on screen is always kept). */
function closeDuplicates(space: Space): TabItem[] {
  const keeper = new Map<string, TabItem>()
  const removed: TabItem[] = []
  for (const tab of looseTabs(space.today)) {
    if (!tab.url) continue
    const first = keeper.get(tab.url)
    if (!first) keeper.set(tab.url, tab)
    else if (tab.id === space.activeId) {
      removed.push(first)
      keeper.set(tab.url, tab)
    } else removed.push(tab)
  }
  if (removed.length) space.today = removeIds(space.today, new Set(removed.map((t) => t.id)))
  return removed
}

/** Group Today tabs from the same website into a folder named after the site (2+ tabs only). */
export function simpleTidy(space: Space): TidyResult {
  const removed = closeDuplicates(space)
  const existing = new Map<string, FolderItem>()
  for (const item of space.today) if (item.kind === 'folder') existing.set(item.name, item)
  const counts = new Map<string, number>()
  for (const item of space.today) {
    const site = item.kind === 'tab' ? siteKey(item.url) : null
    if (site) counts.set(site, (counts.get(site) ?? 0) + 1)
  }
  // A site gets a folder with 2+ loose tabs, or joins a folder Tidy made for it before.
  const grouped = (site: string | null): site is string => !!site && ((counts.get(site) ?? 0) >= 2 || existing.has(site))

  const touched = new Set<FolderItem>()
  const next: SidebarItem[] = []
  for (const item of space.today) {
    const site = item.kind === 'tab' ? siteKey(item.url) : null
    if (item.kind !== 'tab' || !grouped(site)) {
      next.push(item)
      continue
    }
    let folder = existing.get(site)
    if (!folder) {
      folder = newFolder(site)
      existing.set(site, folder)
      next.push(folder)
    }
    folder.children.push(item)
    touched.add(folder)
  }
  space.today = next
  return { removed, folders: touched.size, changed: removed.length > 0 || touched.size > 0 }
}

/** What Claude suggests, by position in the list it was sent (see tidyInput). */
export interface AiTidyPlan {
  folders: { name: string; tabs: number[] }[]
  names: { tab: number; name: string }[]
}

/** The tabs AI Tidy looks at, in order. Only titles and domains are ever sent. */
export function tidyInput(space: Space): {
  tabs: TabItem[]
  lines: { title: string; domain: string }[]
  removed: TabItem[]
} {
  const removed = closeDuplicates(space)
  const tabs = looseTabs(space.today).filter((t) => t.url)
  return { tabs, removed, lines: tabs.map((t) => ({ title: t.title, domain: siteKey(t.url) ?? '' })) }
}

/** Rebuild Today from Claude's plan: topic folders sit where their first tab was. */
export function applyAiPlan(space: Space, tabs: TabItem[], plan: AiTidyPlan, removed: TabItem[]): TidyResult {
  const folderOf = new Map<string, FolderItem>()
  let folders = 0
  for (const f of plan.folders) {
    const members = [...new Set(f.tabs)].map((i) => tabs[i]).filter((t): t is TabItem => !!t && !folderOf.has(t.id))
    if (members.length < 2 || !f.name.trim()) continue
    const folder = newFolder(f.name.trim().slice(0, 40))
    for (const t of members) folderOf.set(t.id, folder)
    folders++
  }
  for (const n of plan.names) {
    const tab = tabs[n.tab]
    const name = n.name.trim()
    if (tab && name && name.length < tab.title.length) tab.name = name.slice(0, 60)
  }
  // Flatten the old Today (dissolving old folders), then regroup.
  const flat: SidebarItem[] = space.today.flatMap((item) => (item.kind === 'folder' ? looseTabsAndSplits(item.children) : [item]))
  const placed = new Set<FolderItem>()
  const next: SidebarItem[] = []
  for (const item of flat) {
    const folder = item.kind === 'tab' ? folderOf.get(item.id) : undefined
    if (!folder) {
      next.push(item)
      continue
    }
    if (!placed.has(folder)) {
      placed.add(folder)
      next.push(folder)
    }
    folder.children.push(item)
  }
  space.today = next
  return { removed, folders, changed: true }
}

function looseTabsAndSplits(list: SidebarItem[]): SidebarItem[] {
  return list.flatMap((item) => (item.kind === 'folder' ? looseTabsAndSplits(item.children) : [item]))
}

/** Remove folders in Today that have nothing left in them. */
export function pruneEmptyFolders(list: SidebarItem[]): SidebarItem[] {
  return list.filter((item) => {
    if (item.kind !== 'folder') return true
    item.children = pruneEmptyFolders(item.children)
    return item.children.length > 0
  })
}
